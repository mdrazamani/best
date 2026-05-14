import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { addMoney, clampMoneyNonNegative, derivePaymentStatus, maxMoney, minMoney, multiplyMoney, percentOf, subtractMoney, toMoneyNumber } from '../../../common/utils/accounting.util';
import { OrdersRepository } from '../orders.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { ListOrdersQueryDto } from '../dto/list-orders-query.dto';

@Injectable()
export class OrdersService extends BaseService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly operationLogsService: OperationLogsService,
    private readonly invoicesService: InvoicesService
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
    return normalized.filter((item) => item.paymentSummary.status === target);
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

    const lineItems = this.normalizeLineItems(dto.lineItems);
    if (!lineItems.length) {
      throw new BadRequestException('برای هر سفارش حداقل یک ردیف معتبر با نوع توری لازم است.');
    }

    const lineItemsTotal = addMoney(...lineItems.map((item) => item.lineTotal));
    const fallbackTotal = multiplyMoney(dto.width ?? 0, dto.height ?? 0, dto.quantity ?? 0, dto.unitPrice ?? 0);
    const discountAmount = clampMoneyNonNegative(dto.discountAmount ?? 0);
    const calculatedBaseTotal = lineItems.length ? lineItemsTotal : fallbackTotal;
    const defaultVatAmount = multiplyMoney(calculatedBaseTotal, 0.1);
    const extraAmount = dto.extraAmount === undefined ? defaultVatAmount : clampMoneyNonNegative(dto.extraAmount);
    const totalPrice = dto.totalPrice === undefined ? maxMoney(addMoney(calculatedBaseTotal, extraAmount), discountAmount).sub(discountAmount) : clampMoneyNonNegative(dto.totalPrice);
    const firstLine = lineItems[0];

    let created: Awaited<ReturnType<OrdersRepository['create']>> | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        created = await this.ordersRepository.create({
          orderNumber: this.generateOrderNumber(orderDateJalali),
          title: dto.title?.trim(),
          orderDateJalali,
          collaboratorId: dto.collaboratorId ?? null,
          customerId: dto.customerId,
          createdById: actorId,
          workType: dto.workType,
          width: firstLine?.width ?? dto.width,
          height: firstLine?.height ?? dto.height,
          quantity: firstLine?.quantity ?? dto.quantity,
          unitPrice: firstLine?.unitPrice ?? dto.unitPrice,
          totalPrice: toMoneyNumber(totalPrice),
          discountAmount: toMoneyNumber(discountAmount),
          extraAmount: toMoneyNumber(extraAmount),
          lineItems,
          description: dto.description?.trim(),
          stage: dto.stage,
          stageNote: dto.stageNote?.trim(),
          expectedCompletionDate: dto.expectedCompletionDate ? new Date(dto.expectedCompletionDate) : undefined
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
      description: 'Order created',
      orderId: created.id
    });

    if (dto.createInitialInvoice !== false) {
      const invoiceAmount = toMoneyNumber(totalPrice);
      await this.invoicesService.create(actorId, {
        orderId: created.id,
        amount: invoiceAmount,
        discountAmount: toMoneyNumber(discountAmount),
        extraAmount: toMoneyNumber(extraAmount),
        paidAmount: 0,
        status: 'UNPAID',
        payerType: created.collaboratorId ? 'COLLABORATOR' : 'CUSTOMER',
        payerId: created.collaboratorId ?? created.customerId,
        dueDate: dto.expectedCompletionDate,
        description: 'فاکتور اولیه سفارش'
      });
    }

    return this.detail(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateOrderDto) {
    const existing = await this.ordersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const lineItems = dto.lineItems ? this.normalizeLineItems(dto.lineItems) : undefined;
    if (dto.lineItems && !lineItems?.length) {
      throw new BadRequestException('ردیف‌های سفارش معتبر نیستند.');
    }

    const currentDiscountAmount = clampMoneyNonNegative(existing.discountAmount ?? 0);
    const currentExtraAmount = clampMoneyNonNegative(existing.extraAmount ?? 0);
    const nextDiscountAmount = dto.discountAmount === undefined ? currentDiscountAmount : clampMoneyNonNegative(dto.discountAmount);
    const nextExtraAmount = dto.extraAmount === undefined ? currentExtraAmount : clampMoneyNonNegative(dto.extraAmount);

    const lineItemsTotal = lineItems ? addMoney(...lineItems.map((item) => item.lineTotal)) : undefined;
    const recalculatedBaseTotal =
      lineItems && lineItems.length
        ? lineItemsTotal
        : dto.unitPrice !== undefined || dto.quantity !== undefined || dto.width !== undefined || dto.height !== undefined
        ? multiplyMoney(
            Number(dto.width ?? existing.width ?? 0),
            Number(dto.height ?? existing.height ?? 0),
            Number(dto.quantity ?? existing.quantity ?? 0),
            Number(dto.unitPrice ?? existing.unitPrice ?? 0)
          )
        : dto.discountAmount !== undefined || dto.extraAmount !== undefined
        ? subtractMoney(addMoney(existing.totalPrice ?? 0, currentDiscountAmount), currentExtraAmount)
        : undefined;

    const totalPrice =
      dto.totalPrice !== undefined
        ? clampMoneyNonNegative(dto.totalPrice)
        : recalculatedBaseTotal !== undefined
        ? maxMoney(addMoney(recalculatedBaseTotal, nextExtraAmount), nextDiscountAmount).sub(nextDiscountAmount)
        : undefined;

    const firstLine = lineItems?.[0];

    await this.ordersRepository.update(id, {
      title: dto.title === undefined ? undefined : dto.title?.trim() ?? null,
      collaboratorId: dto.collaboratorId === undefined ? undefined : dto.collaboratorId ?? null,
      customerId: dto.customerId,
      workType: dto.workType,
      width: firstLine ? firstLine.width : dto.width,
      height: firstLine ? firstLine.height : dto.height,
      quantity: firstLine ? firstLine.quantity : dto.quantity,
      unitPrice: firstLine ? firstLine.unitPrice : dto.unitPrice,
      totalPrice: totalPrice === undefined ? undefined : toMoneyNumber(totalPrice),
      discountAmount: dto.discountAmount === undefined ? undefined : toMoneyNumber(nextDiscountAmount),
      extraAmount: dto.extraAmount === undefined ? undefined : toMoneyNumber(nextExtraAmount),
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
      description: 'Order updated',
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
      description: 'Order soft deleted',
      orderId: id
    });
    return { success: true };
  }

  private withPaymentSummary<T extends { invoices: Array<{ paidAmount: unknown; amount: unknown }>; totalPrice: unknown }>(order: T) {
    const total = clampMoneyNonNegative(order.totalPrice ?? 0);
    const paidAmount = addMoney(
      ...order.invoices.map((invoice) => minMoney(clampMoneyNonNegative(invoice.paidAmount ?? 0), clampMoneyNonNegative(invoice.amount ?? 0)))
    );
    const remainingAmount = maxMoney(subtractMoney(total, paidAmount), 0);
    const percent = percentOf(total, paidAmount);
    const status = derivePaymentStatus(total, paidAmount);

    return {
      ...order,
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

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private normalizeLineItems(items?: Array<{ meshTypeId: string; width: number; height: number; quantity: number; unitPrice: number }>) {
    if (!items?.length) return [];

    return items
      .map((item) => ({
        meshTypeId: item.meshTypeId?.trim(),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0)
      }))
      .filter((item) => Boolean(item.meshTypeId) && item.width > 0 && item.height > 0 && item.quantity > 0 && item.unitPrice >= 0)
      .map((item) => ({
        meshTypeId: item.meshTypeId as string,
        width: toMoneyNumber(item.width),
        height: toMoneyNumber(item.height),
        quantity: toMoneyNumber(item.quantity),
        unitPrice: toMoneyNumber(item.unitPrice),
        lineTotal: toMoneyNumber(multiplyMoney(item.width, item.height, item.quantity, item.unitPrice))
      }));
  }
}
