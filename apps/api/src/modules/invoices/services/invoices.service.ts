import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { BaseService } from '../../../common/services/base.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
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
      throw new NotFoundException('سفارش پيدا نشد.');
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
      throw new NotFoundException('فاکتور پيدا نشد.');
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

  private renderPdf(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      const payerTypeLabel = invoice.payerType === 'COLLABORATOR' ? 'Collaborator' : 'Customer';
      const payerRecord = invoice.payerType === 'COLLABORATOR' ? invoice.order?.collaborator : invoice.order?.customer;
      const payerName = [payerRecord?.firstName, payerRecord?.lastName].filter(Boolean).join(' ') || '-';
      const payerPhone = payerRecord?.phone || '-';
      const payerAddress = payerRecord?.address || '-';
      const lineItems = Array.isArray(invoice.order?.lineItems) ? invoice.order.lineItems : [];
      const meshTypeTitles = Array.from(new Set(lineItems.map((item: any) => item?.meshType?.title).filter(Boolean)));
      const meshTypeText = meshTypeTitles.length ? meshTypeTitles.join(', ') : '-';
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-CA') : '-';
      const paidAt = invoice.paidAt ? new Date(invoice.paidAt).toLocaleString('en-CA', { hour12: false }) : '-';
      const discountAmount = Number(invoice.discountAmount ?? 0);
      const extraAmount = Number(invoice.extraAmount ?? 0);
      const amount = Number(invoice.amount ?? 0);
      const subtotalAmount = amount - extraAmount + discountAmount;

      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('BEST - Invoice');
      doc.moveDown();
      doc.fontSize(11).text('Mesh Workshop');
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Invoice Title: ${invoice.title ?? '-'}`);
      doc.text(`Order Number: ${invoice.order.orderNumber}`);
      doc.text(`Order Title: ${invoice.order.title ?? '-'}`);
      doc.text(`Customer: ${invoice.order.customer.firstName} ${invoice.order.customer.lastName}`);
      doc.text(
        `Collaborator: ${invoice.order.collaborator ? `${invoice.order.collaborator.firstName} ${invoice.order.collaborator.lastName}` : '-'}`
      );
      doc.text(`Mesh Types: ${meshTypeText}`);
      doc.text(`Description: ${invoice.description ?? '-'}`);
      doc.text(`Subtotal: ${subtotalAmount.toLocaleString('en-US')} IRR`);
      doc.text(`Extra Amount: ${extraAmount.toLocaleString('en-US')} IRR`);
      doc.text(`Discount Amount: ${discountAmount.toLocaleString('en-US')} IRR`);
      doc.text(`Amount: ${amount.toLocaleString('en-US')} IRR`);
      doc.text(`Paid Amount: ${Number(invoice.paidAmount).toLocaleString('en-US')} IRR`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown();
      doc.fontSize(12).text('Payer Information');
      doc.fontSize(11).text(`Payer Type: ${payerTypeLabel}`);
      doc.text(`Payer Name: ${payerName}`);
      doc.text(`Payer Phone: ${payerPhone}`);
      doc.text(`Payer Address: ${payerAddress}`);
      doc.text(`Due Date: ${dueDate}`);
      doc.text(`Paid At: ${paidAt}`);
      doc.moveDown(2);
      doc.text('Stamp and Signature');

      doc.end();
    });
  }
}
