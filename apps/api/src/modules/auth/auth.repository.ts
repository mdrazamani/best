import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class AuthRepository extends BaseRepository {
  findLoginAttempt(username: string) {
    return this.prisma.loginAttempt.findUnique({ where: { username } });
  }

  upsertLoginAttempt(username: string, failedCount: number, lockedUntil: Date | null) {
    return this.prisma.loginAttempt.upsert({
      where: { username },
      update: { failedCount, lockedUntil },
      create: { username, failedCount, lockedUntil }
    });
  }

  resetLoginAttempt(username: string) {
    return this.prisma.loginAttempt.upsert({
      where: { username },
      update: { failedCount: 0, lockedUntil: null },
      create: { username, failedCount: 0, lockedUntil: null }
    });
  }
}
