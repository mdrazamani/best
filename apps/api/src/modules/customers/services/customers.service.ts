import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { CustomersRepository } from '../customers.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Injectable()
export class CustomersService extends BaseService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  list(q?: string) {
    return this.customersRepository.list(q?.trim());
  }

  async detail(id: string) {
    const customer = await this.customersRepository.findById(id);
    if (!customer) {
      throw new NotFoundException('مشتري پيدا نشد.');
    }

    const totalOrderAmount = customer.orders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
    const totalReceived = customer.orders.reduce(
      (sum, order) => sum + order.invoices.reduce((inner, invoice) => inner + Number(invoice.paidAmount), 0),
      0
    );

    const collaborators = Array.from(
      new Map(
        customer.orders
          .filter((order) => Boolean(order.collaborator))
          .map((order) => [
            order.collaborator!.id,
            {
              id: order.collaborator!.id,
              firstName: order.collaborator!.firstName,
              lastName: order.collaborator!.lastName,
              phone: order.collaborator!.phone
            }
          ])
      ).values()
    );

    return {
      ...customer,
      summary: {
        totalOrders: customer.orders.length,
        totalOrderAmount,
        totalReceived,
        totalRemaining: Math.max(totalOrderAmount - totalReceived, 0)
      },
      collaborators
    };
  }

  async create(actorId: string, dto: CreateCustomerDto) {
    const created = await this.customersRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone?.trim(),
      address: dto.address?.trim(),
      description: dto.description?.trim(),
      createdById: actorId
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Customer',
      entityId: created.id,
      action: 'CREATE',
      description: 'Customer created'
    });

    return created;
  }

  async update(actorId: string, id: string, dto: UpdateCustomerDto) {
    const existing = await this.customersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('مشتري پيدا نشد.');
    }

    const updated = await this.customersRepository.update(id, {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      phone: dto.phone === undefined ? undefined : dto.phone?.trim() ?? null,
      address: dto.address === undefined ? undefined : dto.address?.trim() ?? null,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Customer',
      entityId: updated.id,
      action: 'UPDATE',
      description: 'Customer updated'
    });

    return updated;
  }

  async remove(actorId: string, id: string) {
    const count = await this.customersRepository.orderCount(id);
    if (count > 0) {
      throw new BadRequestException('مشتري داراي سفارش قابل حذف نيست.');
    }

    await this.customersRepository.delete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Customer',
      entityId: id,
      action: 'DELETE',
      description: 'Customer deleted'
    });

    return { success: true };
  }
}
