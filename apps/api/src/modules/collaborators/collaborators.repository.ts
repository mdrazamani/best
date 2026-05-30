import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class CollaboratorsRepository extends BaseRepository {
  list(query?: string) {
    return this.prisma.collaborator.findMany({
      where: {
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        _count: {
          select: {
            orders: {
              where: {
                deletedAt: null
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.collaborator.findFirst({
      where: { id, deletedAt: null },
      include: {
        orders: {
          where: {
            deletedAt: null
          },
          include: {
            customer: true,
            invoiceLinks: {
              where: {
                invoice: {
                  deletedAt: null
                }
              },
              include: {
                invoice: {
                  include: {
                    payments: {
                      include: {
                        createdBy: {
                          select: { id: true, firstName: true, lastName: true, username: true }
                        }
                      },
                      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] as any
                    }
                  }
                }
              }
            },
            lineItems: {
              include: {
                meshType: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  create(data: { firstName: string; lastName: string; phone?: string; address?: string; description?: string; createdById: string }) {
    return this.prisma.collaborator.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        description: data.description,
        createdById: data.createdById
      }
    });
  }

  update(id: string, data: { firstName?: string; lastName?: string; phone?: string | null; address?: string | null; description?: string | null }) {
    return this.prisma.collaborator.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.collaborator.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
  }

  orderCount(id: string) {
    return this.prisma.order.count({ where: { collaboratorId: id, deletedAt: null } });
  }

  aggregateCollaboratorInvoiceSummary(collaboratorId: string, options?: { beforeDate?: Date; excludeInvoiceId?: string }) {
    return this.prisma.invoice.aggregate({
      _sum: {
        amount: true,
        paidAmount: true
      },
      where: {
        deletedAt: null,
        OR: [
          {
            payerType: 'COLLABORATOR',
            payerId: collaboratorId
          },
          {
            orders: {
              some: {
                order: {
                  collaboratorId,
                  deletedAt: null
                }
              }
            }
          }
        ],
        createdAt: options?.beforeDate ? { lt: options.beforeDate } : undefined,
        id: options?.excludeInvoiceId ? { not: options.excludeInvoiceId } : undefined
      }
    });
  }

  findByIdSafe(id: string) {
    return this.prisma.collaborator.findFirst({
      where: { id, deletedAt: null },
      include: {
        orders: {
          where: {
            deletedAt: null
          },
          include: {
            customer: true,
            invoiceLinks: {
              where: {
                invoice: {
                  deletedAt: null
                }
              },
              include: {
                invoice: {
                  include: {
                    payments: {
                      include: {
                        createdBy: {
                          select: { id: true, firstName: true, lastName: true, username: true }
                        }
                      },
                      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] as any
                    }
                  }
                }
              }
            },
            lineItems: {
              include: {
                meshType: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  listDirectPayments(collaboratorId: string) {
    return this.prisma.collaboratorPayment.findMany({
      where: {
        collaboratorId
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true }
        }
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] as any
    });
  }

  listInvoicesByCollaboratorPayer(collaboratorId: string) {
    return this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        payerType: 'COLLABORATOR',
        payerId: collaboratorId
      },
      include: {
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
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  existsById(id: string) {
    return this.prisma.collaborator.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });
  }

  aggregateCollaboratorDirectPayments(collaboratorId: string, options?: { beforeDate?: Date }) {
    return this.prisma.collaboratorPayment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        collaboratorId,
        paidAt: options?.beforeDate ? { lte: options.beforeDate } : undefined
      }
    });
  }

  addDirectPayment(data: {
    collaboratorId: string;
    amount: number;
    paidAt: Date;
    note?: string;
    createdById: string;
  }) {
    return this.prisma.collaboratorPayment.create({
      data: {
        collaboratorId: data.collaboratorId,
        amount: data.amount,
        paidAt: data.paidAt,
        note: data.note,
        createdById: data.createdById
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true }
        }
      }
    });
  }

  findDirectPaymentById(collaboratorId: string, paymentId: string) {
    return this.prisma.collaboratorPayment.findFirst({
      where: {
        id: paymentId,
        collaboratorId
      },
      include: {
        collaborator: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true }
        }
      }
    });
  }

  aggregateInvoiceSummaryByCollaboratorIds(collaboratorIds: string[]) {
    if (!collaboratorIds.length) return Promise.resolve([]);
    return this.prisma.invoice.groupBy({
      by: ['payerId'],
      _sum: {
        amount: true,
        paidAmount: true
      },
      where: {
        deletedAt: null,
        payerType: 'COLLABORATOR',
        payerId: { in: collaboratorIds }
      }
    });
  }

  aggregateDirectPaymentByCollaboratorIds(collaboratorIds: string[]) {
    if (!collaboratorIds.length) return Promise.resolve([]);
    return this.prisma.collaboratorPayment.groupBy({
      by: ['collaboratorId'],
      _sum: {
        amount: true
      },
      where: {
        collaboratorId: { in: collaboratorIds }
      }
    });
  }
}
