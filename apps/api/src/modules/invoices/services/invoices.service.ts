import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { BaseService } from '../../../common/services/base.service';
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
    const code = new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .format(new Date())
      .replace(/[^0-9]/g, '');

    const prefix = `INV-${code}-`;
    const count = await this.invoicesRepository.countByPrefix(prefix);

    const orderRef = await this.invoicesRepository.findOrderForPayer(dto.orderId);
    if (!orderRef) {
      throw new NotFoundException('سفارش پيدا نشد.');
    }

    const amount = Number(dto.amount ?? 0);
    const paidAmount = Number(dto.paidAmount ?? 0);
    const status = dto.status ?? (paidAmount <= 0 ? 'UNPAID' : paidAmount >= amount ? 'PAID' : 'PARTIAL');
    const payerType = dto.payerType ?? (orderRef.collaboratorId ? 'COLLABORATOR' : 'CUSTOMER');
    const payerId = dto.payerId ?? (payerType === 'COLLABORATOR' ? orderRef.collaboratorId : orderRef.customerId);

    if (payerType === 'COLLABORATOR' && !orderRef.collaboratorId) {
      throw new NotFoundException('برای این سفارش همکار ثبت نشده است.');
    }

    const created = await this.invoicesRepository.create({
      orderId: dto.orderId,
      invoiceNumber: `${prefix}${String(count + 1).padStart(3, '0')}`,
      createdById: actorId,
      amount,
      paidAmount,
      status,
      payerType,
      payerId: payerId ?? undefined,
      description: dto.description?.trim(),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      paidAt: status === 'PAID' ? new Date() : undefined
    });

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
      throw new NotFoundException('فاکتور پيدا نشد.');
    }

    const amount = dto.amount ?? Number(existing.amount);
    const paidAmount = dto.paidAmount ?? Number(existing.paidAmount);
    const status = dto.status ?? (paidAmount <= 0 ? 'UNPAID' : paidAmount >= amount ? 'PAID' : 'PARTIAL');
    const payerType = dto.payerType ?? existing.payerType;
    const payerId = dto.payerId === undefined ? existing.payerId : dto.payerId || null;

    await this.invoicesRepository.update(id, {
      amount: dto.amount,
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
      throw new NotFoundException('فاکتور پيدا نشد.');
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
      throw new NotFoundException('فاکتور پيدا نشد.');
    }

    const buffer = await this.renderPdf(invoice);

    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      buffer
    };
  }

  private renderPdf(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('BEST - Invoice');
      doc.moveDown();
      doc.fontSize(11).text('Mesh Workshop');
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Order Number: ${invoice.order.orderNumber}`);
      doc.text(`Customer: ${invoice.order.customer.firstName} ${invoice.order.customer.lastName}`);
      doc.text(
        `Collaborator: ${invoice.order.collaborator ? `${invoice.order.collaborator.firstName} ${invoice.order.collaborator.lastName}` : '-'}`
      );
      doc.text(`Mesh Type: ${invoice.order.meshType.title}`);
      doc.text(`Description: ${invoice.description ?? '-'}`);
      doc.text(`Amount: ${Number(invoice.amount).toLocaleString('en-US')} IRR`);
      doc.text(`Paid Amount: ${Number(invoice.paidAmount).toLocaleString('en-US')} IRR`);
      doc.text(`Status: ${invoice.status}`);
      doc.text(`Payer Type: ${invoice.payerType}`);
      doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toISOString() : '-'}`);
      doc.text(`Paid At: ${invoice.paidAt ? new Date(invoice.paidAt).toISOString() : '-'}`);
      doc.moveDown(2);
      doc.text('Stamp and Signature');

      doc.end();
    });
  }
}
