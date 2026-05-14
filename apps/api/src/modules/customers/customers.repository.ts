import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class CustomersRepository extends BaseRepository {
  list(query?: string) {
    return this.prisma.customer.findMany({
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
        referredByCollaborator: {
          select: { id: true, firstName: true, lastName: true, phone: true }
        },
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
    return this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        referredByCollaborator: {
          select: { id: true, firstName: true, lastName: true, phone: true }
        },
        orders: {
          where: {
            deletedAt: null
          },
          include: {
            collaborator: true,
            invoices: {
              where: {
                deletedAt: null
              }
            },
            meshType: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  create(data: { firstName: string; lastName: string; phone?: string; address?: string; description?: string; createdById: string; referredByCollaboratorId?: string | null }) {
    return this.prisma.customer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        description: data.description,
        createdById: data.createdById,
        referredByCollaboratorId: data.referredByCollaboratorId
      }
    });
  }

  update(id: string, data: { firstName?: string; lastName?: string; phone?: string | null; address?: string | null; description?: string | null; referredByCollaboratorId?: string | null }) {
    return this.prisma.customer.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
  }

  orderCount(id: string) {
    return this.prisma.order.count({ where: { customerId: id, deletedAt: null } });
  }
}
