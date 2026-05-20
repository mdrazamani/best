import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

type InventoryLogType = 'INCREASE' | 'DECREASE';

@Injectable()
export class InventoryRepository extends BaseRepository {
  list(query?: string) {
    return (this.prisma as any).inventoryItem.findMany({
      where: {
        deletedAt: null,
        ...(query
          ? {
              name: { contains: query, mode: 'insensitive' as const }
            }
          : {})
      },
      include: this.itemInclude(),
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return (this.prisma as any).inventoryItem.findFirst({
      where: { id, deletedAt: null },
      include: this.itemInclude()
    });
  }

  create(data: { name: string; quantity: number; createdById: string }) {
    return (this.prisma as any).inventoryItem.create({
      data: {
        name: data.name,
        quantity: data.quantity,
        createdById: data.createdById
      },
      include: this.itemInclude()
    });
  }

  softDelete(id: string) {
    return (this.prisma as any).inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  adjust(data: { itemId: string; actorId: string; type: InventoryLogType; amount: number; note?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const prisma = tx as any;
      const item = await prisma.inventoryItem.findFirst({
        where: { id: data.itemId, deletedAt: null }
      });

      if (!item) {
        throw new BadRequestException('آیتم انبار پیدا نشد.');
      }

      const nextQuantity = data.type === 'INCREASE' ? item.quantity + data.amount : item.quantity - data.amount;
      if (nextQuantity < 0) {
        throw new BadRequestException('موجودی کافی نیست.');
      }

      const updated = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: nextQuantity },
        include: this.itemInclude()
      });

      const log = await prisma.inventoryLog.create({
        data: {
          itemId: item.id,
          actorId: data.actorId,
          type: data.type,
          amount: data.amount,
          beforeQty: item.quantity,
          afterQty: nextQuantity,
          note: data.note
        },
        include: this.logInclude()
      });

      return { item: updated, log };
    });
  }

  createLog(data: { itemId: string; actorId: string; type: InventoryLogType; amount: number; beforeQty: number; afterQty: number; note?: string }) {
    return (this.prisma as any).inventoryLog.create({
      data,
      include: this.logInclude()
    });
  }

  private itemInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true
        }
      },
      logs: {
        take: 30,
        include: this.logInclude(),
        orderBy: { createdAt: 'desc' as const }
      }
    };
  }

  private logInclude() {
    return {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true
        }
      }
    };
  }
}
