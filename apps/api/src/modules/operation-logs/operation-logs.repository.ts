import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class OperationLogsRepository extends BaseRepository {
  list(limit: number) {
    return this.prisma.operationLog.findMany({
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  create(data: {
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    description?: string;
    orderId?: string;
    payload?: Record<string, unknown>;
  }) {
    return this.prisma.operationLog.create({
      data: {
        actorId: data.actorId,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        description: data.description,
        orderId: data.orderId,
        payload: data.payload as Prisma.InputJsonValue | undefined
      }
    });
  }
}
