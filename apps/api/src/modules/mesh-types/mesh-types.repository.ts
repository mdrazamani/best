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

  create(data: { title: string; description?: string; isActive?: boolean; createdById: string }) {
    return this.prisma.meshType.create({
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true,
        createdById: data.createdById
      }
    });
  }

  update(id: string, data: { title?: string; description?: string | null; isActive?: boolean }) {
    return this.prisma.meshType.update({ where: { id }, data });
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
