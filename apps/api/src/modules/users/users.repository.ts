import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class UsersRepository extends BaseRepository {
  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        status: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        status: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        userRoles: { include: { role: true } }
      }
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: { include: { role: true } }
      }
    });
  }

  create(data: { firstName: string; lastName: string; username: string; passwordHash: string; status?: 'ACTIVE' | 'DISABLED'; locale?: string }) {
    return this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        passwordHash: data.passwordHash,
        status: data.status,
        locale: data.locale ?? 'fa'
      }
    });
  }

  update(id: string, data: { firstName?: string; lastName?: string; username?: string; passwordHash?: string; status?: 'ACTIVE' | 'DISABLED'; locale?: string }) {
    return this.prisma.user.update({
      where: { id },
      data
    });
  }

  addRole(userId: string, roleId: string) {
    return this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId
        }
      },
      update: {},
      create: {
        userId,
        roleId
      }
    });
  }

  removeRole(userId: string, roleId: string) {
    return this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId
      }
    });
  }
}
