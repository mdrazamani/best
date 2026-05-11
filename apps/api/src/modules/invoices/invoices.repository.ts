import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class InvoicesRepository extends BaseRepository {
  list(filter: { q?: string; status?: 'UNPAID' | 'PARTIAL' | 'PAID'; orderId?: string; overdue?: boolean; from?: Date; to?: Date }) {
    const where: Prisma.InvoiceWhereInput = {
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
              { order: { orderNumber: { contains: filter.q, mode: 'insensitive' } } },
              { order: { customer: { firstName: { contains: filter.q, mode: 'insensitive' } } } },
              { order: { customer: { lastName: { contains: filter.q, mode: 'insensitive' } } } }
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
            meshType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        order: {
          include: {
            customer: true,
            collaborator: true,
            meshType: true
          }
        }
      }
    });
  }

  countByPrefix(prefix: string) {
    return this.prisma.invoice.count({ where: { invoiceNumber: { startsWith: prefix } } });
  }

  create(data: {
    orderId: string;
    invoiceNumber: string;
    createdById: string;
    amount: number;
    paidAmount: number;
    status: 'UNPAID' | 'PARTIAL' | 'PAID';
    description?: string;
    dueDate?: Date;
    paidAt?: Date;
  }) {
    return this.prisma.invoice.create({
      data: {
        orderId: data.orderId,
        invoiceNumber: data.invoiceNumber,
        createdById: data.createdById,
        amount: data.amount,
        paidAmount: data.paidAmount,
        status: data.status as any,
        description: data.description,
        dueDate: data.dueDate,
        paidAt: data.paidAt
      }
    });
  }

  update(id: string, data: { amount?: number; paidAmount?: number; status?: 'UNPAID' | 'PARTIAL' | 'PAID'; description?: string | null; dueDate?: Date | null; paidAt?: Date | null }) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        amount: data.amount,
        paidAmount: data.paidAmount,
        status: data.status as any,
        description: data.description,
        dueDate: data.dueDate,
        paidAt: data.paidAt
      }
    });
  }

  delete(id: string) {
    return this.prisma.invoice.delete({ where: { id } });
  }
}
