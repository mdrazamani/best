import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

    const totalOrderAmount = collaborator.orders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
    const totalReceived = collaborator.orders.reduce(
      (sum, order) => sum + order.invoices.reduce((inner, invoice) => inner + Number(invoice.paidAmount), 0),
      0
    );

    const customers = Array.from(
      new Map(
        collaborator.orders.map((order) => [
          order.customer.id,
          {
            id: order.customer.id,
            firstName: order.customer.firstName,
            lastName: order.customer.lastName,
            phone: order.customer.phone
          }
        ])
      ).values()
    );

    return {
      ...collaborator,
      summary: {
        totalOrders: collaborator.orders.length,
        totalOrderAmount,
        totalReceived,
        totalRemaining: Math.max(totalOrderAmount - totalReceived, 0)
      },
      customers
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
      description: 'Collaborator created'
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
      description: 'Collaborator updated'
    });

    return updated;
  }

  async remove(actorId: string, id: string) {
    const count = await this.collaboratorsRepository.orderCount(id);
    if (count > 0) {
      throw new BadRequestException('همکار داراي سفارش قابل حذف نيست.');
    }

    await this.collaboratorsRepository.delete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Collaborator',
      entityId: id,
      action: 'DELETE',
      description: 'Collaborator deleted'
    });

    return { success: true };
  }
}
