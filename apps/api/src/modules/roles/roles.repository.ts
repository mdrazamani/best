import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class RolesRepository extends BaseRepository {
  findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  findByKey(key: string) {
    return this.prisma.role.findUnique({ where: { key } });
  }

  create(data: { key: string; name: string; description?: string; isSystem?: boolean }) {
    return this.prisma.role.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        isSystem: data.isSystem ?? false
      }
    });
  }
}
