import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { addMoney, clampMoneyNonNegative, deriveInvoiceStatus, maxMoney, subtractMoney, toMoneyNumber, toMoneyDecimal } from '../../../common/utils/accounting.util';
import { InvoicesRepository } from '../invoices.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { ListInvoicesQueryDto } from '../dto/list-invoices-query.dto';

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
    return rows.map((row) => this.withConsistentStatus(row));
  }

  async create(actorId: string, dto: CreateInvoiceDto) {
    const jalaliCode = this.jalaliDateCode(new Date());

    const orderRef = await this.invoicesRepository.findOrderForPayer(dto.orderId);
    if (!orderRef) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const discountAmount = clampMoneyNonNegative(dto.discountAmount ?? 0);
    const extraAmount = clampMoneyNonNegative(dto.extraAmount ?? 0);
    const amount = dto.amount !== undefined && dto.amount !== null
      ? clampMoneyNonNegative(dto.amount)
      : maxMoney(subtractMoney(addMoney(orderRef.totalPrice ?? 0, extraAmount), discountAmount), 0);

    const paidAmount = this.resolvePaidAmountForCreate(dto, amount);
    if (paidAmount.greaterThan(amount)) {
      throw new BadRequestException('مبلغ پرداختی نمی‌تواند از مبلغ فاکتور بیشتر باشد.');
    }
    const computedStatus = deriveInvoiceStatus(amount, paidAmount);
    if (dto.status && dto.status !== computedStatus) {
      throw new BadRequestException('وضعیت فاکتور با مبلغ پرداختی هم‌خوانی ندارد.');
    }
    const status = dto.status ?? computedStatus;
    const payerType = dto.payerType ?? (orderRef.collaboratorId ? 'COLLABORATOR' : 'CUSTOMER');
    const payerId = dto.payerId ?? (payerType === 'COLLABORATOR' ? orderRef.collaboratorId : orderRef.customerId);

    if (payerType === 'COLLABORATOR' && !orderRef.collaboratorId) {
      throw new NotFoundException('برای این سفارش همکار ثبت نشده است.');
    }

    let created: Awaited<ReturnType<InvoicesRepository['create']>> | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        created = await this.invoicesRepository.create({
          orderId: dto.orderId,
          invoiceNumber: this.generateInvoiceNumber(jalaliCode),
          title: dto.title?.trim(),
          createdById: actorId,
          amount: toMoneyNumber(amount),
          discountAmount: toMoneyNumber(discountAmount),
          extraAmount: toMoneyNumber(extraAmount),
          paidAmount: toMoneyNumber(paidAmount),
          status,
          payerType,
          payerId: payerId ?? undefined,
          description: dto.description?.trim(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          paidAt: status === 'PAID' ? new Date() : undefined
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
      description: 'Invoice created',
      orderId: created.orderId
    });

    const invoice = await this.invoicesRepository.findById(created.id);
    return invoice ? this.withConsistentStatus(invoice) : invoice;
  }

  async update(actorId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.invoicesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    const currentDiscountAmount = clampMoneyNonNegative(existing.discountAmount ?? 0);
    const currentExtraAmount = clampMoneyNonNegative(existing.extraAmount ?? 0);
    const nextDiscountAmount = dto.discountAmount === undefined ? currentDiscountAmount : clampMoneyNonNegative(dto.discountAmount);
    const nextExtraAmount = dto.extraAmount === undefined ? currentExtraAmount : clampMoneyNonNegative(dto.extraAmount);
    const amount =
      dto.amount !== undefined
        ? clampMoneyNonNegative(dto.amount)
        : dto.discountAmount !== undefined || dto.extraAmount !== undefined
          ? maxMoney(
              addMoney(
                subtractMoney(addMoney(existing.amount ?? 0, currentDiscountAmount), currentExtraAmount),
                nextExtraAmount
              ).sub(nextDiscountAmount),
              0
            )
          : clampMoneyNonNegative(existing.amount);
    const paidAmount = this.resolvePaidAmountForUpdate(existing, dto, amount);
    if (paidAmount.greaterThan(amount)) {
      throw new BadRequestException('مبلغ پرداختی نمی‌تواند از مبلغ فاکتور بیشتر باشد.');
    }
    const computedStatus = deriveInvoiceStatus(amount, paidAmount);
    if (dto.status && dto.status !== computedStatus) {
      throw new BadRequestException('وضعیت فاکتور با مبلغ پرداختی هم‌خوانی ندارد.');
    }
    const status = dto.status ?? computedStatus;
    const payerType = dto.payerType ?? existing.payerType;
    const payerId = dto.payerId === undefined ? existing.payerId : dto.payerId || null;

    await this.invoicesRepository.update(id, {
      title: dto.title === undefined ? undefined : dto.title?.trim() ?? null,
      amount: dto.amount !== undefined || dto.discountAmount !== undefined || dto.extraAmount !== undefined ? toMoneyNumber(amount) : undefined,
      discountAmount: dto.discountAmount === undefined ? undefined : toMoneyNumber(nextDiscountAmount),
      extraAmount: dto.extraAmount === undefined ? undefined : toMoneyNumber(nextExtraAmount),
      paidAmount: dto.paidAmount !== undefined || dto.status !== undefined ? toMoneyNumber(paidAmount) : undefined,
      status,
      payerType,
      payerId,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
      paidAt: status === 'PAID' ? new Date() : null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Invoice',
      entityId: id,
      action: 'UPDATE',
      description: 'Invoice updated',
      orderId: existing.orderId
    });

    const invoice = await this.invoicesRepository.findById(id);
    return invoice ? this.withConsistentStatus(invoice) : invoice;
  }

  private resolvePaidAmountForCreate(dto: CreateInvoiceDto, amount: Prisma.Decimal) {
    if (dto.paidAmount !== undefined && dto.paidAmount !== null) {
      return clampMoneyNonNegative(dto.paidAmount);
    }
    if (dto.status === 'PAID') return amount;
    if (dto.status === 'PARTIAL') {
      throw new BadRequestException('برای وضعیت پرداخت ناقص باید مبلغ پرداختی وارد شود.');
    }
    return toMoneyDecimal(0);
  }

  private resolvePaidAmountForUpdate(existing: any, dto: UpdateInvoiceDto, amount: Prisma.Decimal) {
    if (dto.paidAmount !== undefined && dto.paidAmount !== null) {
      return clampMoneyNonNegative(dto.paidAmount);
    }
    if (dto.status === 'PAID') return amount;
    if (dto.status === 'UNPAID') return toMoneyDecimal(0);
    if (dto.status === 'PARTIAL') {
      const existingPaid = clampMoneyNonNegative(existing.paidAmount ?? 0);
      if (existingPaid.greaterThan(0) && existingPaid.lessThan(amount)) {
        return existingPaid;
      }
      throw new BadRequestException('برای وضعیت پرداخت ناقص باید مبلغ پرداختی معتبر وارد شود.');
    }
    return clampMoneyNonNegative(existing.paidAmount ?? 0);
  }

  async remove(actorId: string, id: string) {
    const existing = await this.invoicesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    await this.invoicesRepository.softDelete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Invoice',
      entityId: id,
      action: 'DELETE',
      description: 'Invoice soft deleted',
      orderId: existing.orderId
    });

    return { success: true };
  }

  async pdf(id: string) {
    const invoice = await this.invoicesRepository.findById(id);
    if (!invoice) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    const html = this.renderInvoiceHtml(this.withConsistentStatus(invoice));
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
    const customer = invoice.order?.customer;
    const collaborator = invoice.order?.collaborator;
    const buyer = invoice.payerType === 'COLLABORATOR' ? collaborator : customer;

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
    const extraAmount = Number(invoice.extraAmount ?? 0);
    const finalAmount = Number(invoice.amount ?? 0);
    const subtotal = Math.max(finalAmount - extraAmount + discountAmount, 0);

    const tableRows = lineItems
      .map((item: any, idx: number) => {
        const meshTitle = this.escapeHtml(item?.meshType?.title ?? 'آیتم');
        const width = Number(item.width ?? 0);
        const height = Number(item.height ?? 0);
        const title = `${meshTitle} (${this.escapeHtml(width)} × ${this.escapeHtml(height)})`;

        return `
          <tr>
            <td>${idx + 1}</td>
            <td class="name-cell">${title}</td>
            <td>${this.escapeHtml(Number(item.quantity ?? 0))}</td>
            <td>${this.formatMoney(item.unitPrice)}</td>
            <td>${this.formatMoney(item.lineTotal)}</td>
          </tr>
        `;
      })
      .join('');

    const emptyRows = tableRows || `<tr><td colspan="5">قلمی برای این فاکتور ثبت نشده است.</td></tr>`;

    const summaryRows: string[] = [];
    summaryRows.push(`
      <div class="sum-row">
        <div class="sum-label">جمع جزء</div>
        <div class="sum-amount">${this.formatMoney(subtotal)}</div>
      </div>
    `);

    if (extraAmount > 0) {
      summaryRows.push(`
        <div class="sum-row">
          <div class="sum-label">مبلغ مالیات ارزش افزوده</div>
          <div class="sum-amount">${this.formatMoney(extraAmount)}</div>
        </div>
      `);
    }

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
        <div class="sum-label">مبلغ قابل پرداخت (ریال)</div>
        <div class="sum-amount">${this.formatMoney(finalAmount)}</div>
      </div>
    `);

    const installmentInfo = showInstallmentInfo
      ? `<p class="installment-note">این فاکتور پارت ${this.escapeHtml(invoicePart)} از ${this.escapeHtml(totalInvoiceParts)} است و مانده سفارش بعد از این فاکتور ${this.escapeHtml(this.formatMoney(remainingAfterCurrent))} ریال می‌باشد.</p>`
      : '';

    const fontFace = this.getVazirmatnFontFaceCss();

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <style>
    ${fontFace}
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
      padding: 6px 2px;
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
      font-size: 42px;
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
      font-size: 28px;
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
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin: 8px 0 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
    }

    th,
    td {
      border: 1px solid var(--border);
      padding: 9px 10px;
      font-size: 12.5px;
      text-align: center;
      vertical-align: middle;
      white-space: nowrap;
    }

    th {
      background: #f3f4f6;
      color: #111827;
      font-weight: 700;
    }

    .name-cell {
      text-align: right;
      white-space: normal;
      font-weight: 500;
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
            <th style="width:58px;">ردیف</th>
            <th>نام کالا</th>
            <th style="width:95px;">تعداد</th>
            <th style="width:170px;">قیمت واحد (ریال)</th>
            <th style="width:180px;">مبلغ کل (ریال)</th>
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




