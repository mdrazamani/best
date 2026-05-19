import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class InvoicesRepository extends BaseRepository {
  private invoiceInclude() {
    return {
      createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      orders: {
        include: {
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
      },
      payments: {
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, username: true }
          }
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] as any
      }
    };
  }

  list(filter: { q?: string; status?: 'UNPAID' | 'PARTIAL' | 'PAID'; orderId?: string; overdue?: boolean; from?: Date; to?: Date }) {
    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      status: filter.status as any,
      createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      orders: filter.orderId
        ? {
            some: {
              orderId: filter.orderId
            }
          }
        : undefined,
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
              {
                orders: {
                  some: {
                    order: {
                      orderNumber: { contains: filter.q, mode: 'insensitive' }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      title: { contains: filter.q, mode: 'insensitive' }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      customer: { firstName: { contains: filter.q, mode: 'insensitive' } }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      customer: { lastName: { contains: filter.q, mode: 'insensitive' } }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      customer: { phone: { contains: filter.q, mode: 'insensitive' } }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      collaborator: { firstName: { contains: filter.q, mode: 'insensitive' } }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      collaborator: { lastName: { contains: filter.q, mode: 'insensitive' } }
                    }
                  }
                }
              },
              {
                orders: {
                  some: {
                    order: {
                      collaborator: { phone: { contains: filter.q, mode: 'insensitive' } }
                    }
                  }
                }
              }
            ]
          }
        : {})
    };

    return this.prisma.invoice.findMany({
      where,
      include: this.invoiceInclude(),
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: this.invoiceInclude()
    });
  }

  findForUpdate(id: string) {
    return this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        orders: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                collaboratorId: true,
                customerId: true,
                stage: true,
                deletedAt: true
              }
            }
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paidAt: true
          }
        }
      }
    });
  }

  countByPrefix(prefix: string) {
    return this.prisma.invoice.count({ where: { deletedAt: null, invoiceNumber: { startsWith: prefix } } });
  }

  findOrdersForInvoice(orderIds: string[]) {
    return this.prisma.order.findMany({
      where: {
        id: { in: orderIds },
        deletedAt: null
      },
      include: {
        customer: true,
        collaborator: true,
        invoiceLinks: {
          where: {
            invoice: {
              deletedAt: null
            }
          },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true
              }
            }
          }
        }
      }
    });
  }

  createWithOrders(data: {
    invoiceNumber: string;
    title?: string;
    createdById: string;
    amount: number;
    discountAmount?: number;
    paidAmount: number;
    status: 'UNPAID' | 'PARTIAL' | 'PAID';
    payerType: 'CUSTOMER' | 'COLLABORATOR';
    payerId?: string;
    description?: string;
    dueDate?: Date;
    paidAt?: Date;
    orderIds: string[];
    initialPayment?: {
      amount: number;
      paidAt: Date;
      note?: string;
      createdById: string;
    };
  }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber: data.invoiceNumber,
          title: data.title,
          createdById: data.createdById,
          amount: data.amount,
          discountAmount: data.discountAmount,
          paidAmount: data.paidAmount,
          status: data.status as any,
          payerType: data.payerType as any,
          payerId: data.payerId,
          description: data.description,
          dueDate: data.dueDate,
          paidAt: data.paidAt
        }
      });

      await tx.invoiceOrder.createMany({
        data: data.orderIds.map((orderId) => ({
          invoiceId: created.id,
          orderId
        }))
      });

      if (data.initialPayment && data.initialPayment.amount > 0) {
        await tx.invoicePayment.create({
          data: {
            invoiceId: created.id,
            amount: data.initialPayment.amount,
            paidAt: data.initialPayment.paidAt,
            note: data.initialPayment.note,
            createdById: data.initialPayment.createdById
          }
        });
      }

      return created;
    });
  }

  update(id: string, data: {
    title?: string | null;
    amount?: number;
    discountAmount?: number;
    paidAmount?: number;
    status?: 'UNPAID' | 'PARTIAL' | 'PAID';
    payerType?: 'CUSTOMER' | 'COLLABORATOR';
    payerId?: string | null;
    description?: string | null;
    dueDate?: Date | null;
    paidAt?: Date | null;
  }) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        title: data.title,
        amount: data.amount,
        discountAmount: data.discountAmount,
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

  addPayment(data: {
    invoiceId: string;
    amount: number;
    paidAt: Date;
    note?: string;
    createdById: string;
    nextPaidAmount: number;
    nextStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    invoicePaidAt: Date | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: data.invoiceId,
          amount: data.amount,
          paidAt: data.paidAt,
          note: data.note,
          createdById: data.createdById
        }
      });

      await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: data.nextPaidAmount,
          status: data.nextStatus as any,
          paidAt: data.invoicePaidAt
        }
      });

      return payment;
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

