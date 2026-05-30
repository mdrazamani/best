import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { addMoney, clampMoneyNonNegative, maxMoney, subtractMoney, toMoneyNumber } from '../../../common/utils/accounting.util';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { buildAttachmentContentDisposition } from '../../../common/utils/download.util';
import { buildPuppeteerLaunchOptions } from '../../../common/utils/puppeteer.util';
import { CollaboratorsRepository } from '../collaborators.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateCollaboratorDto } from '../dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from '../dto/update-collaborator.dto';
import { AddCollaboratorPaymentDto } from '../dto/add-collaborator-payment.dto';

@Injectable()
export class CollaboratorsService extends BaseService {
  constructor(
    private readonly collaboratorsRepository: CollaboratorsRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  async list(q?: string) {
    const collaborators = await this.collaboratorsRepository.list(q?.trim());
    const ids = collaborators.map((item) => item.id);
    const invoiceSums = await this.collaboratorsRepository.aggregateInvoiceSummaryByCollaboratorIds(ids);
    let directPaymentSums: Array<{ collaboratorId: string; _sum: { amount: unknown } }> = [];
    try {
      directPaymentSums = await this.collaboratorsRepository.aggregateDirectPaymentByCollaboratorIds(ids) as Array<{
        collaboratorId: string;
        _sum: { amount: unknown };
      }>;
    } catch (error) {
      if (!this.isMissingCollaboratorPaymentSchemaError(error)) {
        throw error;
      }
    }

    const invoiceSumById = new Map<string, { invoiced: number; invoicePaid: number }>();
    for (const row of invoiceSums) {
      if (!row.payerId) continue;
      invoiceSumById.set(row.payerId, {
        invoiced: Number(row._sum.amount ?? 0),
        invoicePaid: Number(row._sum.paidAmount ?? 0)
      });
    }

    const directPaidById = new Map<string, number>();
    for (const row of directPaymentSums) {
      directPaidById.set(row.collaboratorId, Number(row._sum.amount ?? 0));
    }

    return collaborators.map((item) => {
      const invoiceAgg = invoiceSumById.get(item.id) ?? { invoiced: 0, invoicePaid: 0 };
      const directPaid = directPaidById.get(item.id) ?? 0;
      const totalPaid = invoiceAgg.invoicePaid + directPaid;
      const remaining = Math.max(invoiceAgg.invoiced - totalPaid, 0);

      return {
        ...item,
        accounting: {
          totalInvoiced: invoiceAgg.invoiced,
          totalInvoicePaid: invoiceAgg.invoicePaid,
          totalDirectPaid: directPaid,
          totalPaid,
          remaining
        }
      };
    });
  }

  private isMissingCollaboratorPaymentSchemaError(error: unknown) {
    if (!this.isSchemaMissingError(error)) return false;
    const maybeError = error as { message?: string };
    const message = String(maybeError.message ?? '');
    return message.includes('CollaboratorPayment') || message.includes('collaboratorpayment');
  }

  private isSchemaMissingError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as { code?: string };
    return maybeError.code === 'P2021' || maybeError.code === 'P2022';
  }

  async detail(id: string) {
    let usedSafeFallback = false;
    let missingPaymentsSchema = false;
    let collaborator: any;
    try {
      collaborator = await this.collaboratorsRepository.findById(id);
    } catch (error) {
      if (!this.isSchemaMissingError(error)) {
        throw error;
      }
      usedSafeFallback = true;
      collaborator = await this.collaboratorsRepository.findByIdSafe(id);
    }

    if (!collaborator) {
      throw new NotFoundException('همکار پيدا نشد.');
    }

    const activeOrders = collaborator.orders.filter((order: any) => order.stage !== 'CANCELLED');
    let directPayments: any[] = [];
    try {
      directPayments = await this.collaboratorsRepository.listDirectPayments(id);
    } catch (error) {
      if (!this.isMissingCollaboratorPaymentSchemaError(error)) {
        throw error;
      }
      missingPaymentsSchema = true;
      directPayments = [];
    }

    const payerInvoices = await this.collaboratorsRepository.listInvoicesByCollaboratorPayer(id);
    const invoiceMap = new Map<string, any>();
    for (const order of activeOrders) {
      for (const link of order.invoiceLinks ?? []) {
        const invoice = link.invoice;
        if (!invoice) continue;
        const current = invoiceMap.get(invoice.id);
        if (!current) {
          invoiceMap.set(invoice.id, {
            ...invoice,
            order,
            orders: [order]
          });
          continue;
        }
        current.orders = Array.isArray(current.orders) ? [...current.orders, order] : [order];
      }
    }

    for (const invoice of payerInvoices) {
      const linkedOrders = Array.isArray(invoice.orders) ? invoice.orders.map((link: any) => link?.order).filter(Boolean) : [];
      const current = invoiceMap.get(invoice.id);
      if (!current) {
        invoiceMap.set(invoice.id, {
          ...invoice,
          order: linkedOrders[0] ?? null,
          orders: linkedOrders
        });
        continue;
      }
      const mergedOrders = [...(Array.isArray(current.orders) ? current.orders : []), ...linkedOrders];
      const uniqueOrders = Array.from(new Map(mergedOrders.filter(Boolean).map((item: any) => [item.id, item])).values());
      current.orders = uniqueOrders;
      if (!current.order && uniqueOrders.length) {
        current.order = uniqueOrders[0];
      }
      if (!Array.isArray(current.payments) || !current.payments.length) {
        current.payments = invoice.payments;
      }
    }

    const collaboratorInvoices = Array.from(invoiceMap.values()).filter((invoice) => {
      if (invoice.payerType === 'COLLABORATOR' && invoice.payerId === id) return true;
      const invoiceOrders = Array.isArray(invoice.orders) ? invoice.orders : invoice.order ? [invoice.order] : [];
      return invoiceOrders.some((order: any) => order?.collaborator?.id === id);
    });
    const totalInvoiced = collaboratorInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const totalInvoicePaid = collaboratorInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const totalDirectPaid = directPayments.reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
    const totalPaid = totalInvoicePaid + totalDirectPaid;
    const completedOrders = activeOrders.filter((order: any) => order.stage === 'DELIVERED').length;
    const inProgressOrders = activeOrders.filter((order: any) => ['IN_PROGRESS', 'READY_IN_WAREHOUSE'].includes(order.stage)).length;

    const customers = Array.from(
      new Map(
        activeOrders
          .filter((order: any) => Boolean(order.customer))
          .map((order: any) => [
            order.customer!.id,
            {
              id: order.customer!.id,
              firstName: order.customer!.firstName,
              lastName: order.customer!.lastName,
              phone: order.customer!.phone
            }
          ])
      ).values()
    );

    const invoicePayments = collaboratorInvoices.flatMap((invoice) =>
      Array.isArray(invoice.payments)
        ? invoice.payments.map((payment: any) => ({
            id: `invoice-${payment.id}`,
            source: 'INVOICE',
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(payment.amount ?? 0),
            paidAt: payment.paidAt,
            note: payment.note,
            createdBy: payment.createdBy
          }))
        : []
    );

    const collaboratorPayments = directPayments.map((payment: any) => ({
      id: `collaborator-${payment.id}`,
      source: 'COLLABORATOR',
      collaboratorPaymentId: payment.id,
      amount: Number(payment.amount ?? 0),
      paidAt: payment.paidAt,
      note: payment.note,
      createdBy: payment.createdBy
    }));

    const paymentHistory = [...invoicePayments, ...collaboratorPayments].sort((a, b) => {
      const paidAtDiff = new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
      if (paidAtDiff !== 0) return paidAtDiff;
      return a.id < b.id ? 1 : -1;
    });

    return {
      ...collaborator,
      schemaWarning: usedSafeFallback || missingPaymentsSchema
        ? 'برخی ساختارهای دیتابیس هنوز اعمال نشده‌اند. لطفاً migrationها را کامل اجرا کنید.'
        : undefined,
      summary: {
        totalOrders: activeOrders.length,
        totalOrderAmount: totalInvoiced,
        totalInvoiced,
        totalInvoicePaid,
        totalDirectPaid,
        totalPaid,
        totalRemaining: Math.max(totalInvoiced - totalPaid, 0),
        completedOrders,
        inProgressOrders
      },
      customers,
      invoices: collaboratorInvoices,
      directPayments,
      paymentHistory
    };
  }

  async create(actorId: string, dto: CreateCollaboratorDto) {
    const firstName = dto.firstName?.trim() ?? '';
    const lastName = dto.lastName?.trim() ?? '';
    if (!firstName && !lastName) {
      throw new BadRequestException('حداقل نام یا نام خانوادگی همکار الزامی است.');
    }

    const created = await this.collaboratorsRepository.create({
      firstName,
      lastName,
      phone: dto.phone?.trim(),
      address: dto.address?.trim(),
      description: dto.description?.trim(),
      createdById: actorId
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Collaborator',
      entityId: created.id,
      action: 'CREATE',
      description: 'ایجاد همکار'
    });

    return created;
  }

  async update(actorId: string, id: string, dto: UpdateCollaboratorDto) {
    const existing = await this.collaboratorsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('همکار پيدا نشد.');
    }

    const updated = await this.collaboratorsRepository.update(id, {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      phone: dto.phone === undefined ? undefined : dto.phone?.trim() ?? null,
      address: dto.address === undefined ? undefined : dto.address?.trim() ?? null,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Collaborator',
      entityId: updated.id,
      action: 'UPDATE',
      description: 'ویرایش همکار'
    });

    return updated;
  }

  async addPayment(actorId: string, collaboratorId: string, dto: AddCollaboratorPaymentDto) {
    const existing = await this.collaboratorsRepository.existsById(collaboratorId);
    if (!existing) {
      throw new NotFoundException('همکار پيدا نشد.');
    }

    const paymentAmount = clampMoneyNonNegative(dto.amount ?? 0);
    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('مبلغ پرداخت باید بیشتر از صفر باشد.');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('تاریخ پرداخت معتبر نیست.');
    }

    const balance = await this.getCollaboratorBalance(collaboratorId);
    if (balance.remaining.lessThanOrEqualTo(0)) {
      throw new BadRequestException('این همکار در حال حاضر بدهی تسویه‌نشده ندارد.');
    }
    if (paymentAmount.greaterThan(balance.remaining)) {
      throw new BadRequestException(`مبلغ پرداخت از مانده حساب همکار بیشتر است. مانده فعلی: ${toMoneyNumber(balance.remaining)} تومان`);
    }

    try {
      await this.collaboratorsRepository.addDirectPayment({
        collaboratorId,
        amount: toMoneyNumber(paymentAmount),
        paidAt,
        note: dto.note?.trim(),
        createdById: actorId
      });
    } catch (error) {
      if (!this.isMissingCollaboratorPaymentSchemaError(error)) {
        throw error;
      }
      throw new BadRequestException('ساختار پرداخت همکار در دیتابیس کامل نیست. لطفا migrationها را کامل اجرا کنید.');
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'Collaborator',
      entityId: collaboratorId,
      action: 'UPDATE',
      description: 'ثبت پرداخت همکار'
    });

    return this.detail(collaboratorId);
  }

  async paymentReceiptPdf(collaboratorId: string, paymentId: string) {
    const payment = await this.collaboratorsRepository.findDirectPaymentById(collaboratorId, paymentId);
    if (!payment) {
      throw new NotFoundException('پرداخت همکار پیدا نشد.');
    }

    const paymentDate = new Date(payment.paidAt);
    const beforeDate = new Date(paymentDate.getTime() - 1);

    const [beforeBalance, afterBalance] = await Promise.all([
      this.getCollaboratorBalance(collaboratorId, { beforeDate }),
      this.getCollaboratorBalance(collaboratorId, { beforeDate: paymentDate })
    ]);

    const html = this.renderPaymentReceiptHtml({
      payment,
      beforeRemaining: toMoneyNumber(beforeBalance.remaining),
      remainingAfterPayment: toMoneyNumber(afterBalance.remaining)
    });
    const buffer = await this.renderPdfFromHtml(html);

    const fileName = this.buildPaymentReceiptFileName(payment);
    return {
      fileName,
      contentDisposition: buildAttachmentContentDisposition(fileName),
      buffer
    };
  }

  async remove(actorId: string, id: string) {
    const existing = await this.collaboratorsRepository.existsById(id);
    if (!existing) {
      throw new NotFoundException('همکار پيدا نشد.');
    }

    await this.collaboratorsRepository.softDelete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Collaborator',
      entityId: id,
      action: 'DELETE',
      description: 'حذف همکار'
    });

    return { success: true };
  }

  async getCollaboratorBalance(collaboratorId: string, options?: { beforeDate?: Date; excludeInvoiceId?: string }) {
    const [invoiceAgg, directPaymentAgg] = await Promise.all([
      this.collaboratorsRepository.aggregateCollaboratorInvoiceSummary(collaboratorId, {
        beforeDate: options?.beforeDate,
        excludeInvoiceId: options?.excludeInvoiceId
      }),
      this.collaboratorsRepository.aggregateCollaboratorDirectPayments(collaboratorId, {
        beforeDate: options?.beforeDate
      })
    ]);

    const totalInvoiced = clampMoneyNonNegative(invoiceAgg._sum.amount ?? 0);
    const totalInvoicePaid = clampMoneyNonNegative(invoiceAgg._sum.paidAmount ?? 0);
    const totalDirectPaid = clampMoneyNonNegative(directPaymentAgg._sum.amount ?? 0);
    const totalPaid = addMoney(totalInvoicePaid, totalDirectPaid);
    const remaining = maxMoney(subtractMoney(totalInvoiced, totalPaid), 0);

    return {
      totalInvoiced,
      totalInvoicePaid,
      totalDirectPaid,
      totalPaid,
      remaining
    };
  }

  private buildPaymentReceiptFileName(payment: any) {
    const fullName = this.buildFullName(payment?.collaborator) || 'همکار';
    const datePart = this.formatJalaliDate(payment?.paidAt).replace(/[^\d]/g, '') || 'date';
    const safeName = this.normalizeFileNameSegment(fullName) || 'hamkar';
    return `${safeName}-payment-receipt-${datePart}.pdf`;
  }

  private renderPaymentReceiptHtml(input: {
    payment: any;
    beforeRemaining: number;
    remainingAfterPayment: number;
  }) {
    const { payment, beforeRemaining, remainingAfterPayment } = input;
    const collaboratorName = this.buildFullName(payment?.collaborator) || '-';
    const collaboratorPhone = payment?.collaborator?.phone || '-';
    const paymentAmount = Number(payment?.amount ?? 0);
    const note = String(payment?.note ?? '').trim() || '-';
    const fontFace = this.getVazirmatnFontFaceCss();

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <style>
    ${fontFace}
    @page { size: A4; margin: 14mm 12mm; }
    body { margin: 0; font-family: 'Vazirmatn', Tahoma, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.65; }
    .wrap { border: 1px solid #dbe2ea; border-radius: 14px; padding: 16px; }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .title { font-size: 24px; font-weight: 800; margin: 0; }
    .sub { color: #64748b; font-size: 12px; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; background: #fff; }
    .label { color: #64748b; font-size: 12px; }
    .value { font-size: 15px; font-weight: 700; margin-top: 3px; }
    .table { border: 1px solid #dbe2ea; border-radius: 10px; overflow: hidden; margin-top: 8px; }
    .row { display: flex; border-bottom: 1px solid #e2e8f0; min-height: 42px; align-items: center; }
    .row:last-child { border-bottom: 0; }
    .cell-label { flex: 1; padding: 0 12px; font-weight: 600; }
    .cell-value { width: 260px; border-right: 1px solid #e2e8f0; padding: 0 12px; text-align: left; direction: ltr; unicode-bidi: plaintext; font-weight: 700; }
    .final { background: #f8fafc; font-size: 15px; }
    .note { margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; background: #fcfcfd; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1 class="title">رسید پرداخت</h1>
      </div>
      <div class="sub">${this.escapeHtml(this.formatJalaliDate(payment?.paidAt))}</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">نام</div>
        <div class="value">${this.escapeHtml(collaboratorName)}</div>
      </div>
      <div class="card">
        <div class="label">شماره تماس</div>
        <div class="value">${this.escapeHtml(collaboratorPhone)}</div>
      </div>
    </div>

    <div class="table">
      <div class="row">
        <div class="cell-label">مانده قبل از این (تومان)</div>
        <div class="cell-value">${this.formatMoney(beforeRemaining)}</div>
      </div>
      <div class="row">
        <div class="cell-label">مبلغ رسید (تومان)</div>
        <div class="cell-value">${this.formatMoney(paymentAmount)}</div>
      </div>
      <div class="row final">
        <div class="cell-label">مانده بعد از رسید (تومان)</div>
        <div class="cell-value">${this.formatMoney(remainingAfterPayment)}</div>
      </div>
    </div>

    <div class="note">
      <span class="label">توضیح پرداخت:</span>
      <div class="value">${this.escapeHtml(note)}</div>
    </div>
  </div>
</body>
</html>`;
  }

  private async renderPdfFromHtml(html: string): Promise<Buffer> {
    try {
      const browser = await puppeteer.launch(buildPuppeteerLaunchOptions());
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' }
        });
        return Buffer.from(pdf);
      } finally {
        await browser.close();
      }
    } catch {
      throw new BadRequestException('تولید رسید پرداخت در سرور انجام نشد. لطفا دوباره تلاش کنید.');
    }
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

  private buildFullName(person: any) {
    const firstName = String(person?.firstName ?? '').trim();
    const lastName = String(person?.lastName ?? '').trim();
    return [firstName, lastName].filter(Boolean).join(' ').trim() || null;
  }

  private escapeHtml(value: unknown): string {
    const text = String(value ?? '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatMoney(value: unknown): string {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('fa-IR').format(amount);
  }

  private formatJalaliDate(value?: string | Date | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('fa-IR-u-ca-persian');
  }

  private normalizeFileNameSegment(value: unknown) {
    return String(value ?? '')
      .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '-')
      .slice(0, 60);
  }
}
