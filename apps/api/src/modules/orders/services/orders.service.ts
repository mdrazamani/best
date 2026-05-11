import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { OrdersRepository } from '../orders.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { ListOrdersQueryDto } from '../dto/list-orders-query.dto';

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
    return normalized.filter((item) => item.paymentSummary.status === target);
  }

  async detail(id: string) {
    const row = await this.ordersRepository.findById(id);
    if (!row) {
      throw new NotFoundException('سفارش پيدا نشد.');
    }
    return this.withPaymentSummary(row);
  }

  async create(actorId: string, dto: CreateOrderDto) {
    const orderDateJalali = this.jalaliDateCode(new Date());
    const prefix = `BEST-${orderDateJalali}-`;
    const count = await this.ordersRepository.countByOrderPrefix(prefix);
    const orderNumber = `${prefix}${String(count + 1).padStart(3, '0')}`;

    const totalPrice = dto.totalPrice ?? (dto.unitPrice ?? 0) * (dto.quantity ?? 0);

    const created = await this.ordersRepository.create({
      orderNumber,
      orderDateJalali,
      collaboratorId: dto.collaboratorId ?? null,
      customerId: dto.customerId,
      createdById: actorId,
      workType: dto.workType,
      meshTypeId: dto.meshTypeId,
      width: dto.width,
      height: dto.height,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      totalPrice,
      description: dto.description?.trim(),
      stage: dto.stage,
      stageNote: dto.stageNote?.trim()
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Order',
      entityId: created.id,
      action: 'CREATE',
      description: 'Order created',
      orderId: created.id
    });

    return this.detail(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateOrderDto) {
    const existing = await this.ordersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('سفارش پيدا نشد.');
    }

    const totalPrice =
      dto.totalPrice !== undefined
        ? dto.totalPrice
        : dto.unitPrice !== undefined || dto.quantity !== undefined
        ? Number(dto.unitPrice ?? existing.unitPrice ?? 0) * Number(dto.quantity ?? existing.quantity ?? 0)
        : undefined;

    await this.ordersRepository.update(id, {
      collaboratorId: dto.collaboratorId === undefined ? undefined : dto.collaboratorId ?? null,
      customerId: dto.customerId,
      workType: dto.workType,
      meshTypeId: dto.meshTypeId,
      width: dto.width,
      height: dto.height,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      totalPrice,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      stage: dto.stage,
      stageNote: dto.stageNote === undefined ? undefined : dto.stageNote?.trim() ?? null
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
    await this.ordersRepository.delete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Order',
      entityId: id,
      action: 'DELETE',
      description: 'Order removed',
      orderId: id
    });
    return { success: true };
  }

  private withPaymentSummary<T extends { invoices: Array<{ paidAmount: unknown; amount: unknown }>; totalPrice: unknown }>(order: T) {
    const total = Number(order.totalPrice ?? 0);
    const paidAmount = order.invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? 0), 0);
    const remainingAmount = Math.max(total - paidAmount, 0);
    const percent = total > 0 ? Math.round((paidAmount / total) * 100) : 0;
    const status = remainingAmount === 0 && total > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    return {
      ...order,
      paymentSummary: {
        total,
        paidAmount,
        remainingAmount,
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
}
