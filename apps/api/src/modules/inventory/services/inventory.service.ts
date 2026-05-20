import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { AdjustInventoryItemDto } from '../dto/adjust-inventory-item.dto';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { InventoryRepository } from '../inventory.repository';

const INVENTORY_INCREASE = 'INCREASE' as const;

@Injectable()
export class InventoryService extends BaseService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  list(q?: string) {
    return this.inventoryRepository.list(q?.trim());
  }

  async create(actorId: string, dto: CreateInventoryItemDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('نام آیتم الزامی است.');
    }

    const created = await this.inventoryRepository.create({
      name,
      quantity: dto.quantity,
      createdById: actorId
    });

    if (created.quantity > 0) {
      await this.inventoryRepository.createLog({
        itemId: created.id,
        actorId,
        type: INVENTORY_INCREASE,
        amount: created.quantity,
        beforeQty: 0,
        afterQty: created.quantity,
        note: 'موجودی اولیه'
      });
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'InventoryItem',
      entityId: created.id,
      action: 'CREATE',
      description: 'ایجاد آیتم انبار',
      payload: { name: created.name, quantity: created.quantity }
    });

    return this.inventoryRepository.findById(created.id);
  }

  async adjust(actorId: string, id: string, dto: AdjustInventoryItemDto) {
    const result = await this.inventoryRepository.adjust({
      itemId: id,
      actorId,
      type: dto.type,
      amount: dto.amount,
      note: dto.note?.trim()
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'InventoryItem',
      entityId: id,
      action: dto.type,
      description: dto.type === 'INCREASE' ? 'افزایش موجودی انبار' : 'کاهش موجودی انبار',
      payload: {
        amount: dto.amount,
        beforeQty: result.log.beforeQty,
        afterQty: result.log.afterQty,
        note: result.log.note
      }
    });

    return result.item;
  }

  async remove(actorId: string, id: string) {
    const existing = await this.inventoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('آیتم انبار پیدا نشد.');
    }

    await this.inventoryRepository.softDelete(id);
    await this.operationLogsService.log({
      actorId,
      entityType: 'InventoryItem',
      entityId: id,
      action: 'DELETE',
      description: 'حذف آیتم انبار',
      payload: { name: existing.name, quantity: existing.quantity }
    });

    return { success: true };
  }
}
