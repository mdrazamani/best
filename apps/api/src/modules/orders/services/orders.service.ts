import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';
import { addMoney, clampMoneyNonNegative, deriveInvoiceStatus, derivePaymentStatus, maxMoney, minMoney, multiplyMoney, percentOf, subtractMoney, toMoneyNumber } from '../../../common/utils/accounting.util';
import { buildPuppeteerLaunchOptions } from '../../../common/utils/puppeteer.util';
import { OrdersRepository } from '../orders.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { ListOrdersQueryDto } from '../dto/list-orders-query.dto';

const LABEL_WIDTH_MM = 34;
const LABEL_HEIGHT_MM = 24;

@Injectable()
export class OrdersService extends BaseService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  async list(query: ListOrdersQueryDto) {
    const rows = await this.ordersRepository.list({
      q: query.q?.trim(),
      stage: query.stage,
      workType: query.workType,
      meshTypeId: query.meshTypeId,
      paymentStatus: query.paymentStatus,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined
    });

    const normalized = rows.map((row) => this.withPaymentSummary(row));

    if (!query.paymentStatus) {
      return normalized;
    }

    const target = query.paymentStatus === 'PAID' ? 'paid' : query.paymentStatus === 'PARTIAL' ? 'partial' : 'unpaid';
    return normalized.filter((item) => item.stage !== 'CANCELLED' && item.paymentSummary.status === target);
  }

  async detail(id: string) {
    const row = await this.ordersRepository.findById(id);
    if (!row) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }
    return this.withPaymentSummary(row);
  }

  async create(actorId: string, dto: CreateOrderDto) {
    const orderDateJalali = this.jalaliDateCode(new Date());
    const customerId = this.normalizeId(dto.customerId);
    const collaboratorId = this.normalizeId(dto.collaboratorId);

    if (!customerId && !collaboratorId) {
      throw new BadRequestException('برای ثبت سفارش، حداقل یکی از «مشتری» یا «همکار» الزامی است.');
    }

    const lineItems = this.normalizeLineItems(dto.lineItems);
    if (!lineItems.length) {
      throw new BadRequestException('برای هر سفارش حداقل یک ردیف معتبر با نوع توری لازم است.');
    }

    const lineItemsTotal = addMoney(...lineItems.map((item) => item.lineTotal));
    const fallbackTotal = this.calculateLineTotal(dto.width ?? 0, dto.height ?? 0, dto.quantity ?? 0, dto.unitPrice ?? 0);
    const discountAmount = clampMoneyNonNegative(dto.discountAmount ?? 0);
    const calculatedBaseTotal = lineItems.length ? lineItemsTotal : fallbackTotal;
    const totalPrice =
      dto.totalPrice === undefined
        ? maxMoney(calculatedBaseTotal, discountAmount).sub(discountAmount)
        : clampMoneyNonNegative(dto.totalPrice);
    const firstLine = lineItems[0];

    const hasInitialInvoice = dto.createInitialInvoice !== false;
    if (hasInitialInvoice && !collaboratorId) {
      throw new BadRequestException('صدور فاکتور فقط برای همکار انجام می‌شود. لطفا برای سفارش همکار انتخاب کنید.');
    }
    let created: Awaited<ReturnType<OrdersRepository['createWithInitialInvoice']>> | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        created = await this.ordersRepository.createWithInitialInvoice({
          orderNumber: this.generateOrderNumber(orderDateJalali),
          title: dto.title?.trim(),
          orderDateJalali,
          collaboratorId: collaboratorId ?? null,
          customerId: customerId ?? null,
          createdById: actorId,
          workType: dto.workType,
          width: firstLine?.width ?? dto.width,
          height: firstLine?.height ?? dto.height,
          quantity: firstLine?.quantity ?? dto.quantity,
          unitPrice: firstLine?.unitPrice ?? dto.unitPrice,
          totalPrice: toMoneyNumber(totalPrice),
          discountAmount: toMoneyNumber(discountAmount),
          lineItems,
          description: dto.description?.trim(),
          stage: dto.stage,
          stageNote: dto.stageNote?.trim(),
          expectedCompletionDate: dto.expectedCompletionDate ? new Date(dto.expectedCompletionDate) : undefined,
          initialInvoice: hasInitialInvoice
            ? {
                invoiceNumber: this.generateInvoiceNumber(orderDateJalali),
                amount: toMoneyNumber(totalPrice),
                discountAmount: toMoneyNumber(discountAmount),
                paidAmount: 0,
                status: 'UNPAID',
                payerType: 'COLLABORATOR',
                payerId: collaboratorId ?? undefined,
                dueDate: dto.expectedCompletionDate ? new Date(dto.expectedCompletionDate) : undefined,
                description: 'فاکتور اولیه سفارش'
              }
            : undefined
        });
        break;
      } catch (error) {
        if (!this.isUniqueConstraintError(error) || attempt === 9) {
          throw error;
        }
      }
    }

    if (!created) {
      throw new Error('ثبت سفارش با شماره یکتا انجام نشد.');
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'Order',
      entityId: created.id,
      action: 'CREATE',
      description: 'ایجاد سفارش',
      orderId: created.id
    });

    return this.detail(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateOrderDto) {
    const existing = await this.ordersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }
    const nextCustomerId = dto.customerId === undefined ? existing.customerId ?? null : this.normalizeId(dto.customerId) ?? null;
    const nextCollaboratorId =
      dto.collaboratorId === undefined ? existing.collaboratorId ?? null : this.normalizeId(dto.collaboratorId) ?? null;

    if (!nextCustomerId && !nextCollaboratorId) {
      throw new BadRequestException('برای ثبت سفارش، حداقل یکی از «مشتری» یا «همکار» الزامی است.');
    }

    const lineItems = dto.lineItems ? this.normalizeLineItems(dto.lineItems) : undefined;
    if (dto.lineItems && !lineItems?.length) {
      throw new BadRequestException('ردیف‌های سفارش معتبر نیستند.');
    }

    const currentDiscountAmount = clampMoneyNonNegative(existing.discountAmount ?? 0);
    const nextDiscountAmount = dto.discountAmount === undefined ? currentDiscountAmount : clampMoneyNonNegative(dto.discountAmount);

    const lineItemsTotal = lineItems ? addMoney(...lineItems.map((item) => item.lineTotal)) : undefined;
    const recalculatedBaseTotal =
      lineItems && lineItems.length
        ? lineItemsTotal
        : dto.unitPrice !== undefined || dto.quantity !== undefined || dto.width !== undefined || dto.height !== undefined
        ? this.calculateLineTotal(
            Number(dto.width ?? existing.width ?? 0),
            Number(dto.height ?? existing.height ?? 0),
            Number(dto.quantity ?? existing.quantity ?? 0),
            Number(dto.unitPrice ?? existing.unitPrice ?? 0)
          )
        : dto.discountAmount !== undefined
        ? addMoney(existing.totalPrice ?? 0, currentDiscountAmount)
        : undefined;

    const totalPrice =
      dto.totalPrice !== undefined
        ? clampMoneyNonNegative(dto.totalPrice)
        : recalculatedBaseTotal !== undefined
        ? maxMoney(recalculatedBaseTotal, nextDiscountAmount).sub(nextDiscountAmount)
        : undefined;

    const firstLine = lineItems?.[0];

    await this.ordersRepository.update(id, {
      title: dto.title === undefined ? undefined : dto.title?.trim() ?? null,
      collaboratorId: dto.collaboratorId === undefined ? undefined : nextCollaboratorId,
      customerId: dto.customerId === undefined ? undefined : nextCustomerId,
      workType: dto.workType,
      width: firstLine ? firstLine.width : dto.width,
      height: firstLine ? firstLine.height : dto.height,
      quantity: firstLine ? firstLine.quantity : dto.quantity,
      unitPrice: firstLine ? firstLine.unitPrice : dto.unitPrice,
      totalPrice: totalPrice === undefined ? undefined : toMoneyNumber(totalPrice),
      discountAmount: dto.discountAmount === undefined ? undefined : toMoneyNumber(nextDiscountAmount),
      lineItems,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      stage: dto.stage,
      stageNote: dto.stageNote === undefined ? undefined : dto.stageNote?.trim() ?? null,
      expectedCompletionDate: dto.expectedCompletionDate === undefined ? undefined : dto.expectedCompletionDate ? new Date(dto.expectedCompletionDate) : null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Order',
      entityId: id,
      action: 'UPDATE',
      description: 'ویرایش سفارش',
      orderId: id
    });

    return this.detail(id);
  }

  async remove(actorId: string, id: string) {
    const existing = await this.ordersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    await this.ordersRepository.softDelete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Order',
      entityId: id,
      action: 'DELETE',
      description: 'حذف سفارش',
      orderId: id
    });
    return { success: true };
  }

  async lineItemLabelPdf(orderId: string, lineItemId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const lineItemIndex = lineItems.findIndex((item) => item.id === lineItemId);
    if (lineItemIndex < 0) {
      throw new NotFoundException('آیتم سفارش پیدا نشد.');
    }

    const lineItem = lineItems[lineItemIndex];
    const buffer = await this.renderLabelPdf(order, lineItem, lineItemIndex);
    return {
      fileName: this.buildLabelFileName(order, lineItem, lineItemIndex),
      buffer
    };
  }

  async allLineItemsLabelsZip(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    if (!lineItems.length) {
      throw new BadRequestException('برای این سفارش آیتمی ثبت نشده است.');
    }

    try {
      const labels = await this.renderAllLabelsPdf(order, lineItems);

      const zipBuffer = await this.createZipBuffer(labels);
      return {
        fileName: `labels-${order.orderNumber}.zip`,
        buffer: zipBuffer
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('ساخت فایل فشرده لیبل‌ها در سرور انجام نشد. لطفا دوباره تلاش کنید.');
    }
  }

  private async renderAllLabelsPdf(order: any, lineItems: any[]) {
    const widthMm = LABEL_WIDTH_MM;
    const heightMm = LABEL_HEIGHT_MM;
    const widthPx = this.mmToPx(widthMm);
    const heightPx = this.mmToPx(heightMm);
    const { default: puppeteer } = await import('puppeteer');

    const browser = await puppeteer.launch(buildPuppeteerLaunchOptions());
    try {
      const labels: Array<{ fileName: string; buffer: Buffer }> = [];

      for (let index = 0; index < lineItems.length; index += 1) {
        const item = lineItems[index];
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: widthPx, height: heightPx });
          await page.emulateMediaType('print');
          await page.setContent(this.renderLabelHtml(order, item), { waitUntil: 'domcontentloaded' });
          const pdf = await page.pdf({
            printBackground: true,
            width: `${widthMm}mm`,
            height: `${heightMm}mm`,
            landscape: true,
            scale: 1,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
          });
          labels.push({
            fileName: this.buildLabelFileName(order, item, index),
            buffer: Buffer.from(pdf)
          });
        } finally {
          await page.close();
        }
      }

      return labels;
    } finally {
      await browser.close();
    }
  }

  private withPaymentSummary<T extends { invoiceLinks?: Array<{ invoice?: { paidAmount: unknown; amount: unknown; status?: string } }>; invoices?: Array<{ paidAmount: unknown; amount: unknown; status?: string }>; stage?: string }>(order: T) {
    const linkedInvoices = Array.isArray(order.invoiceLinks)
      ? order.invoiceLinks.map((item) => item?.invoice).filter(Boolean)
      : Array.isArray(order.invoices)
        ? order.invoices
        : [];

    const normalizedInvoices = linkedInvoices.map((invoice: any) => ({
          ...invoice,
          status: deriveInvoiceStatus(invoice.amount, invoice.paidAmount)
        }));
    if (order.stage === 'CANCELLED') {
      return {
        ...order,
        invoices: normalizedInvoices,
        paymentSummary: {
          total: 0,
          paidAmount: 0,
          remainingAmount: 0,
          percent: 0,
          status: 'paid' as const
        }
      };
    }
    const total = addMoney(...normalizedInvoices.map((invoice) => clampMoneyNonNegative(invoice.amount ?? 0)));
    const paidAmount = addMoney(
      ...normalizedInvoices.map((invoice) => minMoney(clampMoneyNonNegative(invoice.paidAmount ?? 0), clampMoneyNonNegative(invoice.amount ?? 0)))
    );
    const remainingAmount = maxMoney(subtractMoney(total, paidAmount), 0);
    const percent = percentOf(total, paidAmount);
    const status = derivePaymentStatus(total, paidAmount);

    return {
      ...order,
      invoices: normalizedInvoices,
      paymentSummary: {
        total: toMoneyNumber(total),
        paidAmount: toMoneyNumber(paidAmount),
        remainingAmount: toMoneyNumber(remainingAmount),
        percent,
        status
      }
    };
  }

  private jalaliDateCode(date: Date) {
    return new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .format(date)
      .replace(/[^0-9]/g, '');
  }

  private generateOrderNumber(jalaliCode: string) {
    const shortDate = jalaliCode.slice(-4);
    const randomPart = randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();
    return `OR-${shortDate}-${randomPart}`;
  }

  private generateInvoiceNumber(jalaliCode: string) {
    const shortDate = jalaliCode.slice(-4);
    const randomPart = randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();
    return `IN-${shortDate}-${randomPart}`;
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private normalizeLineItems(items?: Array<{ meshTypeId: string; width: number; height: number; quantity: number; unitPrice: number; description?: string }>) {
    if (!items?.length) return [];

    return items
      .map((item) => ({
        meshTypeId: item.meshTypeId?.trim(),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        description: item.description?.trim()
      }))
      .filter((item) => Boolean(item.meshTypeId) && item.width > 0 && item.height > 0 && item.quantity > 0 && item.unitPrice >= 0)
      .map((item) => ({
        meshTypeId: item.meshTypeId as string,
        width: toMoneyNumber(item.width),
        height: toMoneyNumber(item.height),
        quantity: toMoneyNumber(item.quantity),
        unitPrice: toMoneyNumber(item.unitPrice),
        lineTotal: toMoneyNumber(this.calculateLineTotal(item.width, item.height, item.quantity, item.unitPrice)),
        description: item.description || null
      }));
  }

  private calculateLineTotal(width: unknown, height: unknown, quantity: unknown, unitPrice: unknown) {
    const widthNumber = Number(width ?? 0);
    const heightNumber = Number(height ?? 0);
    const areaMeters = (widthNumber * heightNumber) / 10000;
    if (areaMeters > 1) {
      return multiplyMoney(quantity, unitPrice, areaMeters);
    }
    return multiplyMoney(quantity, unitPrice);
  }

  private normalizeId(value: unknown) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private buildLabelFileName(order: any, lineItem: any, index: number) {
    const collaboratorName = this.buildPersonFileNamePart(order?.collaborator, 'بدون-همکار');
    const customerName = this.buildPersonFileNamePart(order?.customer, 'بدون-مشتری');
    const dimensions = this.buildDimensionFileNamePart(lineItem);
    const orderNumber = String(order?.orderNumber ?? 'order').trim() || 'order';
    return `${orderNumber}-${collaboratorName}-${customerName}-${dimensions}-item-${index + 1}.pdf`;
  }

  private buildPersonFileNamePart(person: any, fallback: string) {
    const firstName = String(person?.firstName ?? '').trim();
    const lastName = String(person?.lastName ?? '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join('-');
    if (fullName) {
      return this.normalizeFileNamePart(fullName);
    }
    const phone = String(person?.phone ?? '').trim();
    if (phone) {
      return this.normalizeFileNamePart(phone);
    }
    return fallback;
  }

  private buildDimensionFileNamePart(lineItem: any) {
    const width = this.normalizeSizeNumber(lineItem?.width);
    const height = this.normalizeSizeNumber(lineItem?.height);
    return `${width}x${height}`;
  }

  private normalizeSizeNumber(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return '0';
    if (Number.isInteger(parsed)) return String(parsed);
    return String(parsed).replace(/\.?0+$/, '');
  }

  private normalizeFileNamePart(value: string) {
    return value
      .replace(/[\\/:*?"<>|\r\n]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
  }

  private mmToPx(mm: number) {
    return Math.max(Math.round(mm * 3.7795275591), 1);
  }

  private getVazirmatnFontFaceCss() {
    const candidates = [
      path.resolve(__dirname, '../../../common/assets/fonts/vazirmatn/vazirmatn-arabic-wght-normal.woff2'),
      path.resolve(process.cwd(), 'src/common/assets/fonts/vazirmatn/vazirmatn-arabic-wght-normal.woff2'),
      path.resolve(process.cwd(), 'dist/common/assets/fonts/vazirmatn/vazirmatn-arabic-wght-normal.woff2'),
      path.resolve(process.cwd(), '../dashboard/public/fonts/vazirmatn/vazirmatn-arabic-wght-normal.woff2'),
      path.resolve(process.cwd(), 'public/fonts/vazirmatn/vazirmatn-arabic-wght-normal.woff2')
    ];

    for (const fontPath of candidates) {
      if (!fs.existsSync(fontPath)) continue;
      const encoded = fs.readFileSync(fontPath).toString('base64');
      return `@font-face{font-family:'Vazirmatn';src:url(data:font/woff2;base64,${encoded}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;}`;
    }

    return '';
  }

  private escapeHtml(value: unknown) {
    const text = String(value ?? '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private renderLabelHtml(order: any, lineItem: any) {
    const widthCm = Number(lineItem.width ?? 0);
    const heightCm = Number(lineItem.height ?? 0);
    const customerName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || '-';
    const collaboratorPhone = order.collaborator?.phone || '-';
    const dimensions = `${widthCm}×${heightCm}`;
    const fontFace = this.getVazirmatnFontFaceCss();
    const dimensionFontSize = this.pickLabelFontSize(dimensions, 18.4, 13.2);
    const customerFontSize = this.pickLabelFontSize(customerName, 12.6, 8.8);
    const phoneFontSize = this.pickLabelFontSize(collaboratorPhone, 10.8, 7.8);
    const labelInnerWidthMm = Math.max(LABEL_WIDTH_MM - 1, 1);
    const labelInnerHeightMm = Math.max(LABEL_HEIGHT_MM - 1, 1);

    return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
${fontFace}
@page{
  size:${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;
  margin:0;
}
*{box-sizing:border-box}
html,body{
  margin:0;
  padding:0;
  width:${LABEL_WIDTH_MM}mm;
  height:${LABEL_HEIGHT_MM}mm;
}
body{
  font-family:'Vazirmatn',Tahoma,sans-serif;
  direction:rtl;
  color:#0f172a;
  background:#fff;
  display:flex;
  justify-content:center;
  align-items:center;
  overflow:hidden;
}
.label{
  width:${labelInnerWidthMm}mm;
  height:${labelInnerHeightMm}mm;
  border:1px solid #cbd5e1;
  border-radius:1.5mm;
  display:flex;
  justify-content:center;
  align-items:center;
  box-sizing:border-box;
  background:#fff;
}
.rotated-content{
  transform:rotate(-90deg) translateY(-8mm);
  transform-origin:center;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:0.7mm;
}
.line{
  text-align:center;
  line-height:1.12;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.line-1{
  font-weight:900;
  letter-spacing:0.32mm;
}
.line-2{
  transform:translateY(2mm);
  font-weight:700
}
.line-3{
  transform:translateY(5mm);
  font-weight:600;
  letter-spacing:0.32mm;
  direction:ltr;
  unicode-bidi:plaintext;
  font-variant-numeric:tabular-nums;
}
</style>
</head>
<body>
  <div class="label">
    <div class="rotated-content">
      <div class="line line-1" style="font-size:${dimensionFontSize}px">${this.escapeHtml(dimensions)}</div>
      <div class="line line-2" style="font-size:${customerFontSize}px">${this.escapeHtml(customerName)}</div>
      <div class="line line-3" style="font-size:${phoneFontSize}px">${this.escapeHtml(collaboratorPhone)}</div>
    </div>
  </div>
</body>
</html>`;
  }

  private pickLabelFontSize(value: string, baseSize: number, minSize: number) {
    const textLength = String(value ?? '').trim().length;

    if (textLength <= 10) return baseSize;
    if (textLength <= 14) return Math.max(baseSize - 1, minSize);
    if (textLength <= 18) return Math.max(baseSize - 2, minSize);
    if (textLength <= 24) return Math.max(baseSize - 3, minSize);

    return minSize;
  }

  private async renderLabelPdf(order: any, lineItem: any, _index: number) {
    const widthMm = LABEL_WIDTH_MM;
    const heightMm = LABEL_HEIGHT_MM;
    const widthPx = this.mmToPx(widthMm);
    const heightPx = this.mmToPx(heightMm);
    const { default: puppeteer } = await import('puppeteer');

    try {
      const browser = await puppeteer.launch(buildPuppeteerLaunchOptions());

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: widthPx, height: heightPx });
        await page.emulateMediaType('print');
        await page.setContent(this.renderLabelHtml(order, lineItem), { waitUntil: 'domcontentloaded' });
        const pdf = await page.pdf({
          printBackground: true,
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          landscape: true,
          scale: 1,
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
          preferCSSPageSize: true
        });
        return Buffer.from(pdf);
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new BadRequestException('تولید فایل لیبل در سرور انجام نشد. لطفا دوباره تلاش کنید.');
    }
  }

  private createZipBuffer(files: Array<{ fileName: string; buffer: Buffer }>) {
    return import('archiver').then(({ default: archiver }) =>
      new Promise<Buffer>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: Buffer[] = [];
      output.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      output.on('error', reject);
      output.on('end', () => resolve(Buffer.concat(chunks)));

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', reject);
      archive.pipe(output);

      for (const file of files) {
        archive.append(file.buffer, { name: file.fileName });
      }

      void archive.finalize();
      })
    );
  }
}
