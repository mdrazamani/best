import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { BaseService } from '../../../common/services/base.service';
import { SessionsRepository } from '../sessions.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';

@Injectable()
export class SessionsService extends BaseService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  createSession(data: {
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
    return this.sessionsRepository.create(data);
  }

  findById(sessionId: string) {
    return this.sessionsRepository.findById(sessionId);
  }

  async verifyRefreshToken(sessionId: string, refreshToken: string) {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session || session.isRevoked || session.expiresAt <= new Date()) {
      return null;
    }

    const valid = await argon2.verify(session.refreshTokenHash, refreshToken);
    return valid ? session : null;
  }

  rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date) {
    return this.sessionsRepository.updateRefresh(sessionId, refreshTokenHash, expiresAt);
  }

  listForUser(userId: string, currentSessionId: string) {
    return this.sessionsRepository.listByUser(userId).then((rows) =>
      rows.map((row) => ({
        ...row,
        current: row.id === currentSessionId,
        isActive: !row.isRevoked && row.expiresAt > new Date()
      }))
    );
  }

  async revoke(actorId: string, sessionId: string) {
    const existing = await this.sessionsRepository.findById(sessionId);
    if (!existing) {
      throw new NotFoundException('سشن پیدا نشد.');
    }

    await this.sessionsRepository.revoke(sessionId);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Session',
      entityId: sessionId,
      action: 'REVOKE',
      description: 'Session revoked'
    });
    return { success: true };
  }

  cleanupOldSessions(retentionDays: number) {
    return this.sessionsRepository.cleanup(retentionDays);
  }
}
