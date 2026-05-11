import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class OrdersRepository extends BaseRepository {
  list(filter: {
    q?: string;
    stage?: string;
    workType?: string;
    meshTypeId?: string;
    paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.OrderWhereInput = {
      stage: filter.stage as any,
      workType: filter.workType as any,
      meshTypeId: filter.meshTypeId,
      createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      ...(filter.q
        ? {
            OR: [
              { orderNumber: { contains: filter.q, mode: 'insensitive' } },
              { customer: { firstName: { contains: filter.q, mode: 'insensitive' } } },
              { customer: { lastName: { contains: filter.q, mode: 'insensitive' } } },
              { collaborator: { firstName: { contains: filter.q, mode: 'insensitive' } } },
              { collaborator: { lastName: { contains: filter.q, mode: 'insensitive' } } }
            ]
          }
        : {})
    };

    return this.prisma.order.findMany({
      where,
      include: {
        customer: true,
        collaborator: true,
        meshType: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        invoices: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        collaborator: true,
        meshType: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        invoices: {
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true, username: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        operationLogs: {
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true, username: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  countByOrderPrefix(prefix: string) {
    return this.prisma.order.count({
      where: {
        orderNumber: {
          startsWith: prefix
        }
      }
    });
  }

  create(data: {
    orderNumber: string;
    orderDateJalali: string;
    collaboratorId?: string | null;
    customerId: string;
    createdById: string;
    workType: 'NEW_CONSTRUCTION' | 'REPAIR';
    meshTypeId: string;
    width?: number;
    height?: number;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
    description?: string;
    stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
    stageNote?: string;
  }) {
    return this.prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        orderDateJalali: data.orderDateJalali,
        collaboratorId: data.collaboratorId,
        customerId: data.customerId,
        createdById: data.createdById,
        workType: data.workType as any,
        meshTypeId: data.meshTypeId,
        width: data.width,
        height: data.height,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.totalPrice,
        description: data.description,
        stage: data.stage as any,
        stageNote: data.stageNote
      }
    });
  }

  update(id: string, data: {
    collaboratorId?: string | null;
    customerId?: string;
    workType?: 'NEW_CONSTRUCTION' | 'REPAIR';
    meshTypeId?: string;
    width?: number | null;
    height?: number | null;
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice?: number;
    description?: string | null;
    stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
    stageNote?: string | null;
  }) {
    return this.prisma.order.update({
      where: { id },
      data: {
        collaboratorId: data.collaboratorId,
        customerId: data.customerId,
        workType: data.workType as any,
        meshTypeId: data.meshTypeId,
        width: data.width,
        height: data.height,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.totalPrice,
        description: data.description,
        stage: data.stage as any,
        stageNote: data.stageNote
      }
    });
  }

  delete(id: string) {
    return this.prisma.order.delete({ where: { id } });
  }
}
