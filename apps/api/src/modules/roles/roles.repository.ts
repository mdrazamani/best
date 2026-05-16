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

  upsert(data: { key: string; name: string; description?: string; isSystem?: boolean }) {
    return this.prisma.role.upsert({
      where: { key: data.key },
      update: {
        name: data.name,
        description: data.description,
        isSystem: data.isSystem ?? false
      },
      create: {
        key: data.key,
        name: data.name,
        description: data.description,
        isSystem: data.isSystem ?? false
      }
    });
  }

  migrateUsersBetweenRoles(fromRoleId: string, toRoleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignments = await tx.userRole.findMany({
        where: { roleId: fromRoleId },
        select: { userId: true }
      });

      if (assignments.length > 0) {
        await tx.userRole.createMany({
          data: assignments.map((item) => ({
            userId: item.userId,
            roleId: toRoleId
          })),
          skipDuplicates: true
        });
      }

      await tx.userRole.deleteMany({ where: { roleId: fromRoleId } });
    });
  }

  deleteByKey(key: string) {
    return this.prisma.role.deleteMany({
      where: { key }
    });
  }

  findExceptKeys(keys: string[]) {
    return this.prisma.role.findMany({
      where: {
        key: {
          notIn: keys
        }
      }
    });
  }
}
