import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class SessionsRepository extends BaseRepository {
  create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceType?: string;
    deviceModel?: string;
    os?: string;
    browser?: string;
    timezone?: string;
    country?: string;
    language?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.session.create({ data });
  }

  findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  findByRefreshHash(refreshTokenHash: string) {
    return this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        isRevoked: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  listByUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  updateRefresh(sessionId: string, refreshTokenHash: string, expiresAt: Date) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        expiresAt,
        lastActivityAt: new Date()
      }
    });
  }

  revoke(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        lastActivityAt: new Date()
      }
    });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false
      },
      data: {
        isRevoked: true,
        lastActivityAt: new Date()
      }
    });
  }

  cleanup(retentionDays: number) {
    const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, lastActivityAt: { lt: threshold } }
        ]
      }
    });
  }
}
