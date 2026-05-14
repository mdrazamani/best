import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
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

  list(query: ListInvoicesQueryDto) {
    return this.invoicesRepository.list({
      q: query.q?.trim(),
      status: query.status,
      orderId: query.orderId,
      overdue: query.overdue === 'true',
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined
    });
  }

  async create(actorId: string, dto: CreateInvoiceDto) {
    const jalaliCode = this.jalaliDateCode(new Date());

    const orderRef = await this.invoicesRepository.findOrderForPayer(dto.orderId);
    if (!orderRef) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const discountAmount = Number(dto.discountAmount ?? 0);
    const extraAmount = Number(dto.extraAmount ?? 0);
    const amount =
      dto.amount !== undefined && dto.amount !== null
        ? Number(dto.amount)
        : Math.max(Number(orderRef.totalPrice ?? 0) + extraAmount - discountAmount, 0);
    const paidAmount = Number(dto.paidAmount ?? 0);
    const status = dto.status ?? (paidAmount <= 0 ? 'UNPAID' : paidAmount >= amount ? 'PAID' : 'PARTIAL');
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
          amount,
          discountAmount,
          extraAmount,
          paidAmount,
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

    return this.invoicesRepository.findById(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.invoicesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    const currentDiscountAmount = Number(existing.discountAmount ?? 0);
    const currentExtraAmount = Number(existing.extraAmount ?? 0);
    const nextDiscountAmount = dto.discountAmount ?? currentDiscountAmount;
    const nextExtraAmount = dto.extraAmount ?? currentExtraAmount;
    const amount =
      dto.amount !== undefined
        ? dto.amount
        : dto.discountAmount !== undefined || dto.extraAmount !== undefined
          ? Math.max(Number(existing.amount ?? 0) - currentExtraAmount + currentDiscountAmount + nextExtraAmount - nextDiscountAmount, 0)
          : Number(existing.amount);
    const paidAmount = dto.paidAmount ?? Number(existing.paidAmount);
    const status = dto.status ?? (paidAmount <= 0 ? 'UNPAID' : paidAmount >= amount ? 'PAID' : 'PARTIAL');
    const payerType = dto.payerType ?? existing.payerType;
    const payerId = dto.payerId === undefined ? existing.payerId : dto.payerId || null;

    await this.invoicesRepository.update(id, {
      title: dto.title === undefined ? undefined : dto.title?.trim() ?? null,
      amount: dto.amount !== undefined || dto.discountAmount !== undefined || dto.extraAmount !== undefined ? amount : undefined,
      discountAmount: dto.discountAmount,
      extraAmount: dto.extraAmount,
      paidAmount: dto.paidAmount,
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

    return this.invoicesRepository.findById(id);
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

  private renderInvoiceHtml(invoice: any): string {
    const customer = invoice.order?.customer;
    const collaborator = invoice.order?.collaborator;
    const buyer = invoice.payerType === 'COLLABORATOR' ? collaborator : customer;
    const sellerName = 'کارگاه تولیدی بست';
    const sellerPhone = '021-12345678';
    const sellerAddress = 'تهران، خیابان ولیعصر، پلاک 123، واحد 4';
    const sellerNationalId = '140012345678';

    const lineItems = Array.isArray(invoice.order?.lineItems) ? invoice.order.lineItems : [];
    const orderInvoices = Array.isArray(invoice.order?.invoices) ? invoice.order.invoices : [];
    const sortedInvoices = [...orderInvoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const index = Math.max(sortedInvoices.findIndex((item) => item.id === invoice.id), 0);
    const invoiceNumberInOrder = index + 1;
    const totalInvoicesInOrder = sortedInvoices.length || 1;
    const cumulativeIssued = sortedInvoices.slice(0, invoiceNumberInOrder).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const orderTotal = Number(invoice.order?.totalPrice ?? 0);
    const remainingAfterThisInvoice = Math.max(orderTotal - cumulativeIssued, 0);

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

    const fontFace = this.getVazirmatnFontFaceCss();

    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <style>
    ${fontFace}
    :root {
      --border: #dcdcdc;
      --text: #111827;
      --muted: #6b7280;
      --panel: #f9fafb;
      --accent: #111827;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      color: var(--text);
      font-family: 'Vazirmatn', Tahoma, sans-serif;
      background: #fff;
      font-size: 14px;
      line-height: 1.8;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
    }
    .top {
      display: grid;
      grid-template-columns: 1.25fr 1.4fr 0.95fr;
      gap: 14px;
      align-items: stretch;
      margin-bottom: 14px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      background: #fff;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: auto auto 1fr;
      row-gap: 4px;
      column-gap: 8px;
      font-size: 13px;
    }
    .meta-grid .label { color: var(--muted); }
    .title-box {
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      text-align: center;
    }
    .title-box h1 {
      margin: 0 0 4px 0;
      font-size: 46px;
      line-height: 1.1;
      letter-spacing: -0.5px;
      color: var(--accent);
    }
    .title-box p {
      margin: 0;
      color: var(--muted);
      font-size: 16px;
    }
    .logo-box {
      text-align: center;
      background: #f3f4f6;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px;
    }
    .logo-placeholder {
      height: 72px;
      width: 72px;
      margin: 4px auto 8px;
      border: 2px solid #9ca3af;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 12px;
    }
    .persons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .persons h3 {
      margin: 0 0 8px 0;
      font-size: 22px;
      line-height: 1.2;
    }
    .person-grid {
      display: grid;
      grid-template-columns: auto auto 1fr;
      row-gap: 5px;
      column-gap: 8px;
      font-size: 13px;
    }
    .person-grid .label { color: var(--muted); }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 10px;
      text-align: center;
      vertical-align: middle;
      font-size: 13px;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
    }
    .name-cell {
      text-align: right;
      white-space: normal;
    }
    .summary {
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 14px;
    }
    .summary-row {
      display: grid;
      grid-template-columns: 180px 1fr;
      border-bottom: 1px solid var(--border);
      min-height: 42px;
    }
    .summary-row:last-child { border-bottom: 0; }
    .summary-row .value {
      border-left: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 800;
    }
    .summary-row .label {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 16px;
      font-size: 21px;
      font-weight: 700;
    }
    .summary-row.final .value,
    .summary-row.final .label {
      font-weight: 900;
      font-size: 30px;
    }
    .notes {
      border-top: 1px solid #e5e7eb;
      margin-top: 16px;
      padding-top: 12px;
      color: #374151;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="top">
      <div class="card">
        <div class="meta-grid">
          <span class="label">شماره فاکتور</span><span>:</span><strong>${this.escapeHtml(invoice.invoiceNumber)}</strong>
          <span class="label">تاریخ فاکتور</span><span>:</span><strong>${this.escapeHtml(this.formatJalaliDate(invoice.createdAt))}</strong>
          <span class="label">ساعت</span><span>:</span><strong>${this.escapeHtml(this.formatJalaliTime(invoice.createdAt))}</strong>
          <span class="label">شماره سفارش</span><span>:</span><strong>${this.escapeHtml(invoice.order?.orderNumber ?? '-')}</strong>
        </div>
      </div>
      <div class="title-box">
        <h1>فاکتور فروش</h1>
        <p>از همراهی شما سپاسگزاریم.</p>
      </div>
      <div class="logo-box">
        <div class="logo-placeholder">LOGO</div>
        <div style="font-size:14px;font-weight:700;">${this.escapeHtml(sellerName)}</div>
      </div>
    </div>

    <div class="persons">
      <div class="card">
        <h3>فروشنده</h3>
        <div class="person-grid">
          <span class="label">نام فروشگاه</span><span>:</span><strong>${this.escapeHtml(sellerName)}</strong>
          <span class="label">شناسه</span><span>:</span><strong>${this.escapeHtml(sellerNationalId)}</strong>
          <span class="label">تلفن</span><span>:</span><strong>${this.escapeHtml(sellerPhone)}</strong>
          <span class="label">آدرس</span><span>:</span><strong>${this.escapeHtml(sellerAddress)}</strong>
        </div>
      </div>
      <div class="card">
        <h3>خریدار</h3>
        <div class="person-grid">
          <span class="label">نام</span><span>:</span><strong>${this.escapeHtml([buyer?.firstName, buyer?.lastName].filter(Boolean).join(' ') || '-')}</strong>
          <span class="label">شماره همراه</span><span>:</span><strong>${this.escapeHtml(buyer?.phone || '-')}</strong>
          <span class="label">آدرس</span><span>:</span><strong>${this.escapeHtml(buyer?.address || '-')}</strong>
          <span class="label">نوع فاکتور</span><span>:</span><strong>${invoice.payerType === 'COLLABORATOR' ? 'همکار' : 'مشتری'}</strong>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:56px;">ردیف</th>
          <th>شرح کالا</th>
          <th style="width:90px;">تعداد</th>
          <th style="width:150px;">قیمت واحد (ریال)</th>
          <th style="width:170px;">مبلغ کل (ریال)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="5">اقلامی برای این سفارش ثبت نشده است.</td></tr>`}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row"><div class="value">${this.formatMoney(subtotal)}</div><div class="label">جمع جزء</div></div>
      <div class="summary-row"><div class="value">${this.formatMoney(extraAmount)}</div><div class="label">مبلغ افزوده</div></div>
      <div class="summary-row"><div class="value">${this.formatMoney(discountAmount)}</div><div class="label">تخفیف</div></div>
      <div class="summary-row final"><div class="value">${this.formatMoney(finalAmount)}</div><div class="label">مبلغ قابل پرداخت</div></div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div class="person-grid">
        <span class="label">عنوان فاکتور</span><span>:</span><strong>${this.escapeHtml(invoice.title || '-')}</strong>
        <span class="label">وضعیت</span><span>:</span><strong>${this.escapeHtml(invoice.status)}</strong>
        <span class="label">توضیحات</span><span>:</span><strong>${this.escapeHtml(invoice.description || '—')}</strong>
      </div>
    </div>

    <div class="card">
      <div class="person-grid">
        <span class="label">وضعیت صدور در سفارش</span><span>:</span><strong>این فاکتور شماره ${invoiceNumberInOrder} از ${totalInvoicesInOrder} فاکتور سفارش است.</strong>
        <span class="label">مبلغ این فاکتور</span><span>:</span><strong>${this.formatMoney(finalAmount)} ریال</strong>
        <span class="label">مانده سفارش بعد از این فاکتور</span><span>:</span><strong>${this.formatMoney(remainingAfterThisInvoice)} ریال</strong>
      </div>
    </div>

    <div class="notes">
      لطفاً هنگام دریافت کالا، فاکتور را بررسی و نگهداری فرمایید.
    </div>
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
