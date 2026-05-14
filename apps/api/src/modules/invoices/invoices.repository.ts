import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class InvoicesRepository extends BaseRepository {
  list(filter: { q?: string; status?: 'UNPAID' | 'PARTIAL' | 'PAID'; orderId?: string; overdue?: boolean; from?: Date; to?: Date }) {
    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      order: {
        deletedAt: null
      },
      orderId: filter.orderId,
      status: filter.status as any,
      createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      ...(filter.overdue
        ? {
            dueDate: { lt: new Date() },
            status: { not: 'PAID' }
          }
        : {}),
      ...(filter.q
        ? {
            OR: [
              { invoiceNumber: { contains: filter.q, mode: 'insensitive' } },
              { title: { contains: filter.q, mode: 'insensitive' } },
              { order: { orderNumber: { contains: filter.q, mode: 'insensitive' } } },
              { order: { title: { contains: filter.q, mode: 'insensitive' } } },
              { order: { customer: { firstName: { contains: filter.q, mode: 'insensitive' } } } },
              { order: { customer: { lastName: { contains: filter.q, mode: 'insensitive' } } } },
              { order: { customer: { phone: { contains: filter.q, mode: 'insensitive' } } } },
              { order: { collaborator: { firstName: { contains: filter.q, mode: 'insensitive' } } } },
              { order: { collaborator: { lastName: { contains: filter.q, mode: 'insensitive' } } } },
              { order: { collaborator: { phone: { contains: filter.q, mode: 'insensitive' } } } }
            ]
          }
        : {})
    };

    return this.prisma.invoice.findMany({
      where,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        order: {
          include: {
            customer: true,
            collaborator: true,
            lineItems: {
              include: {
                meshType: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.invoice.findFirst({
      where: { id, deletedAt: null, order: { deletedAt: null } },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        order: {
          include: {
            customer: true,
            collaborator: true,
            lineItems: {
              include: {
                meshType: true
              }
            }
          }
        }
      }
    });
  }

  countByPrefix(prefix: string) {
    return this.prisma.invoice.count({ where: { deletedAt: null, invoiceNumber: { startsWith: prefix } } });
  }

  create(data: {
    orderId: string;
    invoiceNumber: string;
    title?: string;
    createdById: string;
    amount: number;
    discountAmount?: number;
    extraAmount?: number;
    paidAmount: number;
    status: 'UNPAID' | 'PARTIAL' | 'PAID';
    payerType: 'CUSTOMER' | 'COLLABORATOR';
    payerId?: string;
    description?: string;
    dueDate?: Date;
    paidAt?: Date;
  }) {
    return this.prisma.invoice.create({
      data: {
        orderId: data.orderId,
        invoiceNumber: data.invoiceNumber,
        title: data.title,
        createdById: data.createdById,
        amount: data.amount,
        discountAmount: data.discountAmount,
        extraAmount: data.extraAmount,
        paidAmount: data.paidAmount,
        status: data.status as any,
        payerType: data.payerType as any,
        payerId: data.payerId,
        description: data.description,
        dueDate: data.dueDate,
        paidAt: data.paidAt
      }
    });
  }

  update(id: string, data: { title?: string | null; amount?: number; discountAmount?: number; extraAmount?: number; paidAmount?: number; status?: 'UNPAID' | 'PARTIAL' | 'PAID'; payerType?: 'CUSTOMER' | 'COLLABORATOR'; payerId?: string | null; description?: string | null; dueDate?: Date | null; paidAt?: Date | null }) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        title: data.title,
        amount: data.amount,
        discountAmount: data.discountAmount,
        extraAmount: data.extraAmount,
        paidAmount: data.paidAmount,
        status: data.status as any,
        payerType: data.payerType as any,
        payerId: data.payerId,
        description: data.description,
        dueDate: data.dueDate,
        paidAt: data.paidAt
      }
    });
  }

  findOrderForPayer(orderId: string) {
    return this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      select: {
        id: true,
        customerId: true,
        collaboratorId: true,
        totalPrice: true,
        discountAmount: true,
        extraAmount: true
      }
    });
  }

  softDelete(id: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
  }
}
