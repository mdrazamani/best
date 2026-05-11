import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class PermissionsRepository extends BaseRepository {
  findAll() {
    return this.prisma.permission.findMany({ orderBy: { resource: 'asc' } });
  }

  findByKey(key: string) {
    return this.prisma.permission.findUnique({ where: { key } });
  }

  listByKeys(keys: string[]) {
    return this.prisma.permission.findMany({ where: { key: { in: keys } } });
  }

  create(data: { key: string; resource: string; apiName: string; method: string; path: string; description?: string }) {
    return this.prisma.permission.create({ data });
  }

  findUserPermission(userId: string, key: string) {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        role: {
          rolePermissions: {
            some: {
              permission: {
                key
              }
            }
          }
        }
      }
    });
  }

  rolePermissionAssign(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId
        }
      },
      update: {},
      create: {
        roleId,
        permissionId
      }
    });
  }

  async syncRolePermissions(roleId: string, permissionIds: string[]) {
    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: {
          notIn: permissionIds.length ? permissionIds : ['__none__']
        }
      }
    });

    if (!permissionIds.length) {
      return;
    }

    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId
      })),
      skipDuplicates: true
    });
  }
}
