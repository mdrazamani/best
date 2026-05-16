import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { CollaboratorsRepository } from '../collaborators.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateCollaboratorDto } from '../dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from '../dto/update-collaborator.dto';

@Injectable()
export class CollaboratorsService extends BaseService {
  constructor(
    private readonly collaboratorsRepository: CollaboratorsRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  list(q?: string) {
    return this.collaboratorsRepository.list(q?.trim());
  }

  async detail(id: string) {
    const collaborator = await this.collaboratorsRepository.findById(id);
    if (!collaborator) {
      throw new NotFoundException('همکار پيدا نشد.');
    }

    const activeOrders = collaborator.orders.filter((order) => order.stage !== 'CANCELLED');
    const allInvoices = activeOrders.flatMap((order) => order.invoices.map((invoice) => ({ ...invoice, order })));
    const collaboratorInvoices = allInvoices.filter((invoice) => invoice.payerType === 'COLLABORATOR');
    const totalInvoiced = collaboratorInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const totalPaid = collaboratorInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const completedOrders = activeOrders.filter((order) => order.stage === 'DELIVERED').length;
    const inProgressOrders = activeOrders.filter((order) => ['STARTED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE'].includes(order.stage)).length;

    const customers = Array.from(
      new Map(
        activeOrders
          .filter((order) => Boolean(order.customer))
          .map((order) => [
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

    return {
      ...collaborator,
      summary: {
        totalOrders: activeOrders.length,
        totalOrderAmount: totalInvoiced,
        totalInvoiced,
        totalPaid,
        totalRemaining: Math.max(totalInvoiced - totalPaid, 0),
        completedOrders,
        inProgressOrders
      },
      customers,
      invoices: collaboratorInvoices
    };
  }

  async create(actorId: string, dto: CreateCollaboratorDto) {
    const created = await this.collaboratorsRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
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

  async remove(actorId: string, id: string) {
    const existing = await this.collaboratorsRepository.findById(id);
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
}
