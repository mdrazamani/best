import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { addMoney, clampMoneyNonNegative, deriveInvoiceStatus, maxMoney, subtractMoney, toMoneyNumber } from '../../../common/utils/accounting.util';
import { InvoicesRepository } from '../invoices.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { ListInvoicesQueryDto } from '../dto/list-invoices-query.dto';
import { AddInvoicePaymentDto } from '../dto/add-invoice-payment.dto';

@Injectable()
export class InvoicesService extends BaseService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  async list(query: ListInvoicesQueryDto) {
    const rows = await this.invoicesRepository.list({
      q: query.q?.trim(),
      status: query.status,
      orderId: query.orderId,
      overdue: query.overdue === 'true',
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined
    });
    return rows.map((row) => this.withConsistentStatus(this.normalizeInvoiceShape(row)));
  }

  async detail(id: string) {
    const row = await this.invoicesRepository.findById(id);
    if (!row) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }
    return this.withConsistentStatus(this.normalizeInvoiceShape(row));
  }

  async create(actorId: string, dto: CreateInvoiceDto) {
    const jalaliCode = this.jalaliDateCode(new Date());
    const orderIds = Array.from(new Set((dto.orderIds ?? []).map((item) => item?.trim()).filter(Boolean)));
    if (!orderIds.length) {
      throw new BadRequestException('حداقل یک سفارش باید انتخاب شود.');
    }

    const orderRefs = await this.invoicesRepository.findOrdersForInvoice(orderIds);
    if (orderRefs.length !== orderIds.length) {
      throw new NotFoundException('یک یا چند سفارش انتخاب‌شده پیدا نشد.');
    }

    const linkedOrders = orderRefs.filter((order) => order.invoiceLinks.length > 0);
    if (linkedOrders.length) {
      const orderNumbers = linkedOrders.map((order) => order.orderNumber).join('، ');
      throw new BadRequestException(`برای سفارش(های) ${orderNumbers} قبلا فاکتور ثبت شده است و امکان ثبت مجدد وجود ندارد.`);
    }

    const cancelledOrders = orderRefs.filter((order) => order.stage === 'CANCELLED');
    if (cancelledOrders.length) {
      const orderNumbers = cancelledOrders.map((order) => order.orderNumber).join('، ');
      throw new BadRequestException(`سفارش(های) لغوشده (${orderNumbers}) قابل فاکتورکردن نیستند.`);
    }

    const ordersTotalAmount = addMoney(...orderRefs.map((order) => clampMoneyNonNegative(order.totalPrice ?? 0)));
    const ordersDiscountAmount = addMoney(...orderRefs.map((order: any) => clampMoneyNonNegative(order.discountAmount ?? 0)));

    const discountAmount =
      dto.discountAmount === undefined || dto.discountAmount === null
        ? ordersDiscountAmount
        : clampMoneyNonNegative(dto.discountAmount);

    const amount =
      dto.amount !== undefined && dto.amount !== null
        ? clampMoneyNonNegative(dto.amount)
        : dto.discountAmount === undefined || dto.discountAmount === null
          ? ordersTotalAmount
          : maxMoney(subtractMoney(ordersTotalAmount, discountAmount), 0);

    const paidAmount = clampMoneyNonNegative(dto.initialPaidAmount ?? 0);
    if (paidAmount.greaterThan(amount)) {
      throw new BadRequestException('مبلغ پرداختی نمی‌تواند از مبلغ فاکتور بیشتر باشد.');
    }

    const computedStatus = deriveInvoiceStatus(amount, paidAmount);
    if (dto.status && dto.status !== computedStatus) {
      throw new BadRequestException('وضعیت فاکتور با مبلغ پرداختی هم‌خوانی ندارد.');
    }
    const status = dto.status ?? computedStatus;

    const payerType = 'COLLABORATOR' as const;
    const payerId = dto.payerId ?? this.resolveDefaultCollaboratorPayerId(orderRefs);
    const normalizedPayerId = payerId ?? undefined;
    this.validateCollaboratorPayerForOrders(orderRefs, normalizedPayerId);

    let created: Awaited<ReturnType<InvoicesRepository['createWithOrders']>> | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const now = new Date();
        created = await this.invoicesRepository.createWithOrders({
          invoiceNumber: this.generateInvoiceNumber(jalaliCode),
          title: dto.title?.trim(),
          createdById: actorId,
          amount: toMoneyNumber(amount),
          discountAmount: toMoneyNumber(discountAmount),
          paidAmount: toMoneyNumber(paidAmount),
          status,
          payerType,
          payerId: normalizedPayerId,
          description: dto.description?.trim(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          paidAt: status === 'PAID' ? now : undefined,
          orderIds,
          initialPayment:
            paidAmount.greaterThan(0)
              ? {
                  amount: toMoneyNumber(paidAmount),
                  paidAt: now,
                  note: 'پرداخت اولیه هنگام ثبت فاکتور',
                  createdById: actorId
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
      throw new Error('ثبت فاکتور با شماره یکتا انجام نشد.');
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'Invoice',
      entityId: created.id,
      action: 'CREATE',
      description: 'ایجاد فاکتور',
      orderId: orderIds[0]
    });

    return this.detail(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.invoicesRepository.findForUpdate(id);
    if (!existing) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    const orderRefs = existing.orders.map((item) => item.order).filter(Boolean) as Array<{
      id: string;
      orderNumber: string;
      collaboratorId: string | null;
      customerId: string | null;
    }>;

    const currentDiscountAmount = clampMoneyNonNegative(existing.discountAmount ?? 0);
    const nextDiscountAmount = dto.discountAmount === undefined ? currentDiscountAmount : clampMoneyNonNegative(dto.discountAmount);
    const amount =
      dto.amount !== undefined
        ? clampMoneyNonNegative(dto.amount)
        : dto.discountAmount !== undefined
          ? maxMoney(subtractMoney(addMoney(existing.amount ?? 0, currentDiscountAmount), nextDiscountAmount), 0)
          : clampMoneyNonNegative(existing.amount);

    const paidAmount = clampMoneyNonNegative(existing.paidAmount ?? 0);
    if (paidAmount.greaterThan(amount)) {
      throw new BadRequestException('مبلغ فاکتور نمی‌تواند از مجموع پرداخت‌های ثبت‌شده کمتر باشد.');
    }

    const computedStatus = deriveInvoiceStatus(amount, paidAmount);
    if (dto.status && dto.status !== computedStatus) {
      throw new BadRequestException('وضعیت فاکتور از روی تاریخچه پرداخت محاسبه می‌شود.');
    }

    const payerType = 'COLLABORATOR' as const;
    const payerIdFromExisting = existing.payerType === 'COLLABORATOR' ? existing.payerId : null;
    const payerId = dto.payerId === undefined ? payerIdFromExisting : dto.payerId || null;
    const resolvedPayerId = payerId ?? this.resolveDefaultCollaboratorPayerId(orderRefs) ?? null;
    this.validateCollaboratorPayerForOrders(orderRefs, resolvedPayerId ?? undefined);

    await this.invoicesRepository.update(id, {
      title: dto.title === undefined ? undefined : dto.title?.trim() ?? null,
      amount: dto.amount !== undefined || dto.discountAmount !== undefined ? toMoneyNumber(amount) : undefined,
      discountAmount: dto.discountAmount === undefined ? undefined : toMoneyNumber(nextDiscountAmount),
      paidAmount: toMoneyNumber(paidAmount),
      status: computedStatus,
      payerType,
      payerId: resolvedPayerId,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
      paidAt: computedStatus === 'PAID' ? new Date() : null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Invoice',
      entityId: id,
      action: 'UPDATE',
      description: 'ویرایش فاکتور',
      orderId: existing.orders[0]?.orderId
    });

    return this.detail(id);
  }

  async addPayment(actorId: string, id: string, dto: AddInvoicePaymentDto) {
    const existing = await this.invoicesRepository.findForUpdate(id);
    if (!existing) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    const amount = clampMoneyNonNegative(existing.amount ?? 0);
    const paidAmount = clampMoneyNonNegative(existing.paidAmount ?? 0);
    const remaining = maxMoney(subtractMoney(amount, paidAmount), 0);

    if (remaining.lessThanOrEqualTo(0)) {
      throw new BadRequestException('این فاکتور قبلا کامل تسویه شده است.');
    }

    const paymentAmount = clampMoneyNonNegative(dto.amount ?? 0);
    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('مبلغ پرداخت باید بیشتر از صفر باشد.');
    }
    if (paymentAmount.greaterThan(remaining)) {
      throw new BadRequestException(`مبلغ پرداخت از مانده فاکتور بیشتر است. مانده فعلی: ${toMoneyNumber(remaining)} تومان`);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('تاریخ پرداخت معتبر نیست.');
    }

    const nextPaidAmount = addMoney(paidAmount, paymentAmount);
    const nextStatus = deriveInvoiceStatus(amount, nextPaidAmount);

    await this.invoicesRepository.addPayment({
      invoiceId: id,
      amount: toMoneyNumber(paymentAmount),
      paidAt,
      note: dto.note?.trim(),
      createdById: actorId,
      nextPaidAmount: toMoneyNumber(nextPaidAmount),
      nextStatus,
      invoicePaidAt: nextStatus === 'PAID' ? paidAt : null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Invoice',
      entityId: id,
      action: 'UPDATE',
      description: 'ثبت پرداخت فاکتور',
      orderId: existing.orders[0]?.orderId
    });

    return this.detail(id);
  }

  async remove(actorId: string, id: string) {
    const existing = await this.invoicesRepository.findForUpdate(id);
    if (!existing) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    await this.invoicesRepository.softDelete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Invoice',
      entityId: id,
      action: 'DELETE',
      description: 'حذف فاکتور',
      orderId: existing.orders[0]?.orderId
    });

    return { success: true };
  }

  async pdf(id: string) {
    const invoice = await this.detail(id);
    const html = this.renderInvoiceHtml(invoice);
    const buffer = await this.renderPdfFromHtml(html);

    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      buffer
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

  private generateInvoiceNumber(jalaliCode: string) {
    const shortDate = jalaliCode.slice(-4);
    const randomPart = randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();
    return `IN-${shortDate}-${randomPart}`;
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private resolveDefaultCollaboratorPayerId(orders: Array<{ collaboratorId: string | null }>) {
    const collaboratorIds = Array.from(new Set(orders.map((item) => item.collaboratorId).filter(Boolean)));
    return collaboratorIds.length === 1 ? collaboratorIds[0] : undefined;
  }

  private validateCollaboratorPayerForOrders(
    orders: Array<{ orderNumber: string; collaboratorId: string | null }>,
    payerId?: string
  ) {
    if (!payerId) {
      throw new BadRequestException('برای صدور فاکتور، انتخاب همکار الزامی است.');
    }

    const ordersWithoutCollaborator = orders.filter((item) => !item.collaboratorId);
    if (ordersWithoutCollaborator.length) {
      const orderNumbers = ordersWithoutCollaborator.map((item) => item.orderNumber).join('، ');
      throw new BadRequestException(`سفارش(های) ${orderNumbers} همکار ندارند و قابل صدور فاکتور نیستند.`);
    }

    const invalidOrders = orders.filter((item) => item.collaboratorId !== payerId);

    if (invalidOrders.length) {
      const orderNumbers = invalidOrders.map((item) => item.orderNumber).join('، ');
      throw new BadRequestException(`همکار انتخاب‌شده با سفارش(های) ${orderNumbers} هم‌خوانی ندارد.`);
    }
  }

  private normalizeInvoiceShape(invoice: any) {
    const orders = Array.isArray(invoice.orders)
      ? invoice.orders.map((link: any) => link?.order).filter(Boolean)
      : [];

    const combinedLineItems = orders.flatMap((order: any) =>
      Array.isArray(order.lineItems)
        ? order.lineItems.map((item: any) => ({
            ...item,
            orderNumber: order.orderNumber
          }))
        : []
    );

    const firstOrder = orders[0];
    const syntheticOrder = firstOrder
      ? {
          ...firstOrder,
          orderNumber: orders.map((item: any) => item.orderNumber).join(' + '),
          totalPrice: orders.reduce((sum: number, item: any) => sum + Number(item.totalPrice ?? 0), 0),
          lineItems: combinedLineItems,
          invoices: [{ id: invoice.id, amount: invoice.amount, createdAt: invoice.createdAt }]
        }
      : null;

    return {
      ...invoice,
      orders,
      order: syntheticOrder,
      paymentHistory: Array.isArray(invoice.payments) ? invoice.payments : []
    };
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

  private formatJalaliTime(value?: string | Date | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }

  private withConsistentStatus<T extends { amount: unknown; paidAmount: unknown; status?: string }>(invoice: T): T {
    const computedStatus = deriveInvoiceStatus(invoice.amount, invoice.paidAmount);
    if (invoice.status === computedStatus) {
      return invoice;
    }

    return {
      ...invoice,
      status: computedStatus
    };
  }

  private getVazirmatnFontFaceCss() {
    const candidates = [
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

  private getInvoiceLogoDataUri() {
    const candidates = [
      path.resolve(process.cwd(), 'src/modules/invoices/assets/torbest-logo.png'),
      path.resolve(process.cwd(), 'apps/api/src/modules/invoices/assets/torbest-logo.png'),
      path.resolve(__dirname, '../assets/torbest-logo.png')
    ];

    for (const logoPath of candidates) {
      if (!fs.existsSync(logoPath)) continue;
      const encoded = fs.readFileSync(logoPath).toString('base64');
      return `data:image/jpeg;base64,${encoded}`;
    }

    return null;
  }

  private renderInvoiceHtml(invoice: any): string {
    const collaborator = invoice.order?.collaborator;
    const buyer = collaborator;

    const sellerName = 'تولیدی توربست';
    const sellerPhonePrimary = '09124617758';
    const sellerPhoneSecondary = '09004617758';
    const sellerPhone = `${sellerPhonePrimary} - ${sellerPhoneSecondary}`;
    const sellerAddress = 'میانجاده، جنب خیابان عدل، بن‌بست 12، پلاک 1';
    const logoDataUri = this.getInvoiceLogoDataUri();

    const buyerName = [buyer?.firstName, buyer?.lastName].filter(Boolean).join(' ') || '-';
    const buyerPhone = buyer?.phone || '-';
    const buyerAddress = buyer?.address || '-';

    const lineItems = Array.isArray(invoice.order?.lineItems) ? invoice.order.lineItems : [];
    const orderInvoices = Array.isArray(invoice.order?.invoices) ? invoice.order.invoices : [];
    const sortedInvoices = [...orderInvoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const currentInvoiceIndex = Math.max(sortedInvoices.findIndex((item) => item.id === invoice.id), 0);
    const invoicePart = currentInvoiceIndex + 1;
    const totalInvoiceParts = sortedInvoices.length || 1;

    const orderTotal = Number(invoice.order?.totalPrice ?? 0);
    const issuedUntilCurrent = sortedInvoices.slice(0, invoicePart).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const remainingAfterCurrent = Math.max(orderTotal - issuedUntilCurrent, 0);
    const showInstallmentInfo = totalInvoiceParts > 1;

    const discountAmount = Number(invoice.discountAmount ?? 0);
    const finalAmount = Number(invoice.amount ?? 0);
    const subtotal = Math.max(finalAmount + discountAmount, 0);

    const tableRows = lineItems
      .map((item: any, idx: number) => {
        const meshTitle = this.escapeHtml(item?.meshType?.title ?? 'آیتم');
        const width = Number(item.width ?? 0);
        const height = Number(item.height ?? 0);
        const dimensions = `${this.escapeHtml(width)} × ${this.escapeHtml(height)}`;
        const description = this.escapeHtml(item?.description ?? '-');

        return `
          <tr>
            <td>${idx + 1}</td>
            <td class="name-cell">
              <div class="item-title">${meshTitle}</div>
              <div class="item-sub">(${dimensions})</div>
            </td>
            <td>${this.escapeHtml(Number(item.quantity ?? 0))}</td>
            <td>${this.formatMoney(item.unitPrice)}</td>
            <td>${this.formatMoney(item.lineTotal)}</td>
            <td class="desc-cell">${description}</td>
          </tr>
        `;
      })
      .join('');

    const emptyRows = tableRows || `<tr><td colspan="6">قلمی برای این فاکتور ثبت نشده است.</td></tr>`;

    const summaryRows: string[] = [];
    summaryRows.push(`
      <div class="sum-row">
        <div class="sum-label">جمع جزء</div>
        <div class="sum-amount">${this.formatMoney(subtotal)}</div>
      </div>
    `);

    if (discountAmount > 0) {
      summaryRows.push(`
        <div class="sum-row">
          <div class="sum-label">تخفیف</div>
          <div class="sum-amount">${this.formatMoney(discountAmount)}</div>
        </div>
      `);
    }

    summaryRows.push(`
      <div class="sum-row final">
        <div class="sum-label">مبلغ قابل پرداخت (تومان)</div>
        <div class="sum-amount">${this.formatMoney(finalAmount)}</div>
      </div>
    `);

    const installmentInfo = showInstallmentInfo
      ? `<p class="installment-note">این فاکتور پارت ${this.escapeHtml(invoicePart)} از ${this.escapeHtml(totalInvoiceParts)} است و مانده سفارش بعد از این فاکتور ${this.escapeHtml(this.formatMoney(remainingAfterCurrent))} تومان می‌باشد.</p>`
      : '';

    const fontFace = this.getVazirmatnFontFaceCss();

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <style>
    ${fontFace}
    @page {
      size: A4;
      margin: 12mm 10mm 12mm 10mm;
    }

    :root {
      --text: #111827;
      --muted: #6b7280;
      --border: #d6d9df;
      --surface: #f3f4f6;
      --soft: #f8fafc;
      --heading: #0f172a;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--text);
      background: #fff;
      font-family: 'Vazirmatn', Tahoma, sans-serif;
      font-size: 12.5px;
      line-height: 1.65;
      direction: rtl;
    }

    .invoice {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: 0;
      page-break-after: auto;
    }

    .header {
      display: grid;
      grid-template-columns: 1.05fr 1.2fr 0.65fr;
      gap: 14px;
      align-items: stretch;
      margin-bottom: 14px;
    }

    .meta {
      border-left: 1px solid var(--border);
      padding-left: 10px;
      align-content: center;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: auto auto 1fr;
      row-gap: 6px;
      column-gap: 8px;
      font-size: 12.5px;
    }

    .meta-grid .label {
      color: var(--muted);
      font-weight: 600;
      white-space: nowrap;
    }

    .meta-grid strong {
      font-size: 13px;
      font-weight: 700;
      color: var(--heading);
      letter-spacing: 0.1px;
    }

    .title-block {
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 4px 12px;
    }

    .title-block h1 {
      margin: 0;
      font-size: 36px;
      line-height: 1.15;
      color: #020617;
      font-weight: 800;
      letter-spacing: -0.4px;
    }

    .logo-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 8px;
    }

    .logo-image {
      width: 100%;
      max-width: 140px;
      max-height: 130px;
      object-fit: contain;
    }

    .logo-fallback {
      font-size: 19px;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 1px;
    }

    .party-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .party-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      background: #fff;
    }

    .party-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .party-header h3 {
      margin: 0;
      font-size: 22px;
      line-height: 1.1;
      color: var(--heading);
      font-weight: 800;
    }

    .party-header svg {
      width: 20px;
      height: 20px;
      stroke: #111827;
      stroke-width: 1.8;
      fill: none;
    }

    .party-info {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 6px 8px;
      font-size: 12.5px;
    }

    .party-info .label {
      color: var(--muted);
      font-weight: 600;
      white-space: nowrap;
    }

    .party-info strong {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }

    .party-info strong.single-line {
      white-space: nowrap;
      font-size: 12px;
      letter-spacing: -0.1px;
    }

    .table-wrap {
      margin: 8px 0 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 0;
      table-layout: auto;
    }

    thead {
      display: table-header-group;
    }

    tfoot {
      display: table-footer-group;
    }

    th,
    td {
      border: 0;
      border-inline-start: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 9px 10px;
      font-size: 12.5px;
      text-align: center;
      vertical-align: middle;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th:first-child,
    td:first-child {
      border-inline-start: 0;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    th {
      background: #f3f4f6;
      color: #111827;
      font-weight: 700;
      white-space: nowrap;
    }

    td {
      white-space: nowrap;
    }

    .name-cell {
      text-align: right;
      white-space: normal;
      font-weight: 500;
      word-break: normal;
      overflow-wrap: break-word;
      line-height: 1.45;
    }

    .desc-cell {
      text-align: right;
      white-space: normal;
      word-break: normal;
      overflow-wrap: break-word;
      line-height: 1.45;
    }

    .item-title {
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }

    .item-sub {
      font-size: 12px;
      color: #4b5563;
      direction: ltr;
      unicode-bidi: plaintext;
      text-align: right;
    }

    .summary {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .sum-row {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border);
      min-height: 42px;
      background: #fff;
    }

    .sum-row:last-child { border-bottom: 0; }

    .sum-label {
      flex: 1;
      text-align: right;
      padding: 0 14px;
      font-size: 14px;
      color: #111827;
      font-weight: 600;
    }

    .sum-amount {
      width: 220px;
      border-right: 1px solid var(--border);
      text-align: left;
      padding: 0 14px;
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      direction: ltr;
      unicode-bidi: plaintext;
    }

    .sum-row.final .sum-label,
    .sum-row.final .sum-amount {
      font-size: 18px;
      font-weight: 800;
      color: #0b1220;
      background: var(--soft);
    }

    .notes {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      text-align: right;
    }

    .notes-head {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      margin-bottom: 8px;
      color: #111827;
      font-size: 15px;
      font-weight: 700;
    }

    .notes-head svg {
      width: 18px;
      height: 18px;
      stroke: #111827;
      stroke-width: 1.8;
      fill: none;
    }

    .installment-note {
      margin: 0;
      font-size: 12px;
      color: #4b5563;
    }

    .footer {
      padding-top: 4px;
      margin-top: 2px;
    }

    .thank-you {
      text-align: center;
      color: #374151;
      font-size: 12px;
      font-weight: 500;
      margin: 0;
    }

    .header,
    .party-grid,
    .party-card,
    .summary,
    .notes,
    .footer {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <section class="header">
      <div class="meta">
        <div class="meta-grid">
          <span class="label">شماره فاکتور</span><span>:</span><strong>${this.escapeHtml(invoice.invoiceNumber)}</strong>
          <span class="label">تاریخ فاکتور</span><span>:</span><strong>${this.escapeHtml(this.formatJalaliDate(invoice.createdAt))}</strong>
          <span class="label">ساعت</span><span>:</span><strong>${this.escapeHtml(this.formatJalaliTime(invoice.createdAt))}</strong>
          <span class="label">شماره سفارش</span><span>:</span><strong>${this.escapeHtml(invoice.order?.orderNumber ?? '-')}</strong>
        </div>
      </div>

      <div class="title-block">
        <h1>فاکتور فروش</h1>
      </div>

      <div class="logo-card">
        ${logoDataUri ? `<img class="logo-image" src="${logoDataUri}" alt="لوگوی توربست" />` : '<span class="logo-fallback">TORBEST</span>'}
      </div>
    </section>

    <section class="party-grid">
      <article class="party-card">
        <div class="party-header">
          <h3>خریدار</h3>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 20a8 8 0 0 1 16 0"></path>
          </svg>
        </div>
        <div class="party-info">
          <span class="label">نام خریدار</span><span>:</span><strong>${this.escapeHtml(buyerName)}</strong>
          <span class="label">شماره همراه</span><span>:</span><strong>${this.escapeHtml(buyerPhone)}</strong>
          <span class="label">آدرس</span><span>:</span><strong>${this.escapeHtml(buyerAddress)}</strong>
        </div>
      </article>

      <article class="party-card">
        <div class="party-header">
          <h3>فروشنده</h3>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9l2-5h14l2 5"></path>
            <path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"></path>
            <path d="M9 13h6"></path>
          </svg>
        </div>
        <div class="party-info">
          <span class="label">نام فروشگاه</span><span>:</span><strong>${this.escapeHtml(sellerName)}</strong>
          <span class="label">تلفن</span><span>:</span><strong>${this.escapeHtml(sellerPhone)}</strong>
          <span class="label">آدرس</span><span>:</span><strong class="single-line">${this.escapeHtml(sellerAddress)}</strong>
        </div>
      </article>
    </section>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:54px;">ردیف</th>
            <th>نام کالا</th>
            <th style="width:72px;">تعداد</th>
            <th style="width:138px;">قیمت واحد (تومان)</th>
            <th style="width:148px;">مبلغ کل (تومان)</th>
            <th style="width:170px;">توضیحات</th>
          </tr>
        </thead>
        <tbody>
          ${emptyRows}
        </tbody>
      </table>
    </div>

    <section class="summary">
      ${summaryRows.join('')}
    </section>

    ${showInstallmentInfo ? `
    <section class="notes">
      <div class="notes-head">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <path d="M14 2v6h6"></path>
          <path d="M8 13h8M8 17h6"></path>
        </svg>
        <span>توضیحات</span>
      </div>
      ${installmentInfo}
    </section>
    ` : ''}

    <footer class="footer">
      <p class="thank-you">از اعتماد و خرید شما سپاسگزاریم.</p>
    </footer>
  </div>
</body>
</html>`;
  }
  private async renderPdfFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'domcontentloaded'
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' }
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}





