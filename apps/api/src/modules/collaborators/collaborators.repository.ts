import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class CollaboratorsRepository extends BaseRepository {
  list(query?: string) {
    return this.prisma.collaborator.findMany({
      where: query
        ? {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } }
            ]
          }
        : undefined,
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.collaborator.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            customer: true,
            invoices: true,
            meshType: true
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

  delete(id: string) {
    return this.prisma.collaborator.delete({ where: { id } });
  }

  orderCount(id: string) {
    return this.prisma.order.count({ where: { collaboratorId: id } });
  }
}
