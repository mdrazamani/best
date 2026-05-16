import { Injectable, NotFoundException } from '@nestjs/common';
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
      throw new NotFoundException('مشتری پيدا نشد.');
    }

    const activeOrders = customer.orders.filter((order) => order.stage !== 'CANCELLED');
    const allInvoices = activeOrders.flatMap((order) => order.invoices.map((invoice) => ({ ...invoice, order })));
    const customerInvoices = allInvoices.filter((invoice) => invoice.payerType === 'CUSTOMER' || !invoice.payerType);
    const totalInvoiced = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const totalPaid = customerInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const completedOrders = activeOrders.filter((order) => order.stage === 'DELIVERED').length;
    const inProgressOrders = activeOrders.filter((order) => ['STARTED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE'].includes(order.stage)).length;

    const collaborators = Array.from(
      new Map(
        activeOrders
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
        totalOrders: activeOrders.length,
        totalOrderAmount: totalInvoiced,
        totalInvoiced,
        totalPaid,
        totalRemaining: Math.max(totalInvoiced - totalPaid, 0),
        completedOrders,
        inProgressOrders
      },
      collaborators,
      invoices: customerInvoices
    };
  }

  async create(actorId: string, dto: CreateCustomerDto) {
    const created = await this.customersRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone?.trim(),
      address: dto.address?.trim(),
      description: dto.description?.trim(),
      createdById: actorId,
      referredByCollaboratorId: dto.referredByCollaboratorId ?? null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Customer',
      entityId: created.id,
      action: 'CREATE',
      description: 'ایجاد مشتری'
    });

    return created;
  }

  async update(actorId: string, id: string, dto: UpdateCustomerDto) {
    const existing = await this.customersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('مشتری پيدا نشد.');
    }

    const updated = await this.customersRepository.update(id, {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      phone: dto.phone === undefined ? undefined : dto.phone?.trim() ?? null,
      address: dto.address === undefined ? undefined : dto.address?.trim() ?? null,
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      referredByCollaboratorId: dto.referredByCollaboratorId === undefined ? undefined : dto.referredByCollaboratorId ?? null
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'Customer',
      entityId: updated.id,
      action: 'UPDATE',
      description: 'ویرایش مشتری'
    });

    return updated;
  }

  async remove(actorId: string, id: string) {
    const existing = await this.customersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('مشتری پيدا نشد.');
    }

    await this.customersRepository.softDelete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Customer',
      entityId: id,
      action: 'DELETE',
      description: 'حذف مشتری'
    });

    return { success: true };
  }
}
