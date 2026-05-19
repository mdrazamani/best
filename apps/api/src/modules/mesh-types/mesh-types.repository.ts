import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class MeshTypesRepository extends BaseRepository {
  list(query?: string) {
    return this.prisma.meshType.findMany({
      where: {
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.meshType.findFirst({ where: { id, deletedAt: null } });
  }

  create(data: { title: string; description?: string; isActive?: boolean; unitPrice?: number; isDefault?: boolean; createdById: string }) {
    return this.prisma.meshType.create({
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true,
        unitPrice: data.unitPrice ?? 0,
        isDefault: data.isDefault ?? false,
        createdById: data.createdById
      }
    });
  }

  update(id: string, data: { title?: string; description?: string | null; isActive?: boolean; unitPrice?: number; isDefault?: boolean }) {
    return this.prisma.meshType.update({ where: { id }, data });
  }

  clearDefault(excludeId?: string) {
    return this.prisma.meshType.updateMany({
      where: {
        deletedAt: null,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      data: {
        isDefault: false
      }
    });
  }

  findDefaultActive() {
    return this.prisma.meshType.findFirst({
      where: {
        deletedAt: null,
        isDefault: true,
        isActive: true
      }
    });
  }

  findFirstActive(excludeId?: string) {
    return this.prisma.meshType.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  softDelete(id: string) {
    return this.prisma.meshType.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });
  }
}
