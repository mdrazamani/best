import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class OrdersRepository extends BaseRepository {
  private buildOrderCreateData(data: {
    orderNumber: string;
    title?: string;
    orderDateJalali: string;
    collaboratorId?: string | null;
    customerId: string;
    createdById: string;
    workType: 'NEW_CONSTRUCTION' | 'REPAIR';
    width?: number;
    height?: number;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
    discountAmount?: number;
    extraAmount?: number;
    lineItems?: Array<{
      meshTypeId: string;
      width: number;
      height: number;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    description?: string;
    stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
    stageNote?: string;
    expectedCompletionDate?: Date;
  }) {
    return {
      orderNumber: data.orderNumber,
      title: data.title,
      orderDateJalali: data.orderDateJalali,
      collaboratorId: data.collaboratorId,
      customerId: data.customerId,
      createdById: data.createdById,
      workType: data.workType as any,
      width: data.width,
      height: data.height,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      totalPrice: data.totalPrice,
      discountAmount: data.discountAmount,
      extraAmount: data.extraAmount,
      lineItems: data.lineItems?.length
        ? {
            create: data.lineItems.map((item) => ({
              meshTypeId: item.meshTypeId,
              width: item.width,
              height: item.height,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal
            }))
          }
        : undefined,
      description: data.description,
      stage: data.stage as any,
      stageNote: data.stageNote,
      expectedCompletionDate: data.expectedCompletionDate
    };
  }

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
      deletedAt: null,
      stage: filter.stage as any,
      workType: filter.workType as any,
      lineItems: filter.meshTypeId
        ? {
            some: {
              meshTypeId: filter.meshTypeId
            }
          }
        : undefined,
      createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      ...(filter.q
        ? {
            OR: [
              { orderNumber: { contains: filter.q, mode: 'insensitive' } },
              { title: { contains: filter.q, mode: 'insensitive' } },
              { customer: { firstName: { contains: filter.q, mode: 'insensitive' } } },
              { customer: { lastName: { contains: filter.q, mode: 'insensitive' } } },
              { customer: { phone: { contains: filter.q, mode: 'insensitive' } } },
              { collaborator: { firstName: { contains: filter.q, mode: 'insensitive' } } },
              { collaborator: { lastName: { contains: filter.q, mode: 'insensitive' } } },
              { collaborator: { phone: { contains: filter.q, mode: 'insensitive' } } }
            ]
          }
        : {})
    };

    return this.prisma.order.findMany({
      where,
      include: {
        customer: true,
        collaborator: true,
        lineItems: {
          include: {
            meshType: true
          }
        },
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        invoices: {
          where: {
            deletedAt: null
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        collaborator: true,
        lineItems: {
          include: {
            meshType: true
          }
        },
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        invoices: {
          where: {
            deletedAt: null
          },
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
        deletedAt: null,
        orderNumber: {
          startsWith: prefix
        }
      }
    });
  }

  create(data: {
    orderNumber: string;
    title?: string;
    orderDateJalali: string;
    collaboratorId?: string | null;
    customerId: string;
    createdById: string;
    workType: 'NEW_CONSTRUCTION' | 'REPAIR';
    width?: number;
    height?: number;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
    discountAmount?: number;
    extraAmount?: number;
    lineItems?: Array<{
      meshTypeId: string;
      width: number;
      height: number;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    description?: string;
    stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
    stageNote?: string;
    expectedCompletionDate?: Date;
  }) {
    return this.prisma.order.create({
      data: this.buildOrderCreateData(data)
    });
  }

  createWithInitialInvoice(
    data: {
      orderNumber: string;
      title?: string;
      orderDateJalali: string;
      collaboratorId?: string | null;
      customerId: string;
      createdById: string;
      workType: 'NEW_CONSTRUCTION' | 'REPAIR';
      width?: number;
      height?: number;
      quantity?: number;
      unitPrice?: number;
      totalPrice: number;
      discountAmount?: number;
      extraAmount?: number;
      lineItems?: Array<{
        meshTypeId: string;
        width: number;
        height: number;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>;
      description?: string;
      stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
      stageNote?: string;
      expectedCompletionDate?: Date;
      initialInvoice?: {
        invoiceNumber: string;
        title?: string;
        amount: number;
        discountAmount: number;
        extraAmount: number;
        paidAmount: number;
        status: 'UNPAID' | 'PARTIAL' | 'PAID';
        payerType: 'CUSTOMER' | 'COLLABORATOR';
        payerId?: string | null;
        dueDate?: Date;
        description?: string;
      };
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: this.buildOrderCreateData(data)
      });

      if (data.initialInvoice) {
        await tx.invoice.create({
          data: {
            orderId: createdOrder.id,
            invoiceNumber: data.initialInvoice.invoiceNumber,
            title: data.initialInvoice.title,
            createdById: data.createdById,
            amount: data.initialInvoice.amount,
            discountAmount: data.initialInvoice.discountAmount,
            extraAmount: data.initialInvoice.extraAmount,
            paidAmount: data.initialInvoice.paidAmount,
            status: data.initialInvoice.status as any,
            payerType: data.initialInvoice.payerType as any,
            payerId: data.initialInvoice.payerId ?? null,
            description: data.initialInvoice.description,
            dueDate: data.initialInvoice.dueDate
          }
        });
      }

      return createdOrder;
    });
  }

  update(id: string, data: {
    title?: string | null;
    collaboratorId?: string | null;
    customerId?: string;
    workType?: 'NEW_CONSTRUCTION' | 'REPAIR';
    width?: number | null;
    height?: number | null;
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice?: number;
    discountAmount?: number;
    extraAmount?: number;
    lineItems?: Array<{
      meshTypeId: string;
      width: number;
      height: number;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    description?: string | null;
    stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';
    stageNote?: string | null;
    expectedCompletionDate?: Date | null;
  }) {
    return this.prisma.order.update({
      where: { id },
      data: {
        title: data.title,
        collaboratorId: data.collaboratorId,
        customerId: data.customerId,
        workType: data.workType as any,
        width: data.width,
        height: data.height,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.totalPrice,
        discountAmount: data.discountAmount,
        extraAmount: data.extraAmount,
        lineItems: data.lineItems
          ? {
              deleteMany: {},
              create: data.lineItems.map((item) => ({
                meshTypeId: item.meshTypeId,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal
              }))
            }
          : undefined,
        description: data.description,
        stage: data.stage as any,
        stageNote: data.stageNote,
        expectedCompletionDate: data.expectedCompletionDate
      }
    });
  }

  softDelete(id: string) {
    return this.prisma.order.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
  }
}
