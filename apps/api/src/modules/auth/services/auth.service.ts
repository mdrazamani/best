import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { BaseService } from '../../../common/services/base.service';
import { UsersService } from '../../users/services/users.service';
import { SessionsService } from '../../sessions/services/sessions.service';
import { AuthRepository } from '../auth.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { AuthTokenPayload } from '../auth.entity';

@Injectable()
export class AuthService extends BaseService {
  private readonly loginRateByIp = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number | null }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly authRepository: AuthRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  async login(input: { username: string; password: string; context: Record<string, string | undefined> }) {
    this.assertLoginRateLimit(input.context);

    const username = input.username.trim();
    const password = input.password.trim();

    const attempt = await this.authRepository.findLoginAttempt(username);
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new UnauthorizedException('\u062d\u0633\u0627\u0628 \u0634\u0645\u0627 \u0645\u0648\u0642\u062a\u0627\u064b \u0642\u0641\u0644 \u0634\u062f\u0647 \u0627\u0633\u062a.');
    }

    const user = await this.usersService.findByUsernameWithRoles(username);
    if (!user || user.status !== 'ACTIVE') {
      await this.registerFailedLogin(username);
      throw new UnauthorizedException('\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc \u06cc\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u062f\u0631\u0633\u062a \u0627\u0633\u062a.');
    }

    const verified = await argon2.verify(user.passwordHash, password);
    if (!verified) {
      await this.registerFailedLogin(username);
      throw new UnauthorizedException('\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc \u06cc\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0646\u0627\u062f\u0631\u0633\u062a \u0627\u0633\u062a.');
    }

    await this.authRepository.resetLoginAttempt(username);

    const session = await this.sessionsService.createSession({
      userId: user.id,
      refreshTokenHash: 'pending',
      expiresAt: this.refreshTokenExpiryDate(),
      deviceType: input.context['x-device-type'],
      deviceModel: input.context['x-device-model'],
      os: input.context['x-os'],
      browser: input.context['x-browser'],
      timezone: input.context['x-timezone'],
      country: input.context['x-country'],
      language: input.context['x-language'],
      ipAddress: input.context['x-forwarded-for'],
      userAgent: input.context['user-agent']
    });

    const roleKeys = user.userRoles.map((item) => item.role.key);

    const accessToken = this.signToken(
      {
        sub: user.id,
        username: user.username,
        sid: session.id,
        roles: roleKeys,
        type: 'access',
        jti: randomUUID()
      },
      this.accessTokenTtl
    );

    const refreshToken = this.signToken(
      {
        sub: user.id,
        username: user.username,
        sid: session.id,
        roles: roleKeys,
        type: 'refresh',
        jti: randomUUID()
      },
      this.refreshTokenTtl
    );

    await this.sessionsService.rotateSession(session.id, {
      refreshTokenHash: await argon2.hash(refreshToken),
      expiresAt: this.refreshTokenExpiryDate(),
      previousRefreshTokenHash: null,
      previousRefreshValidUntil: null
    });

    await this.operationLogsService.log({
      actorId: user.id,
      entityType: 'Auth',
      entityId: user.id,
      action: 'LOGIN',
      description: '\u0648\u0631\u0648\u062f \u06a9\u0627\u0631\u0628\u0631'
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        roles: roleKeys
      }
    };
  }

  async refreshToken(refreshToken: string) {
    const payload = this.verifyToken(refreshToken, 'refresh');
    const sessionMatch = await this.sessionsService.verifyRefreshToken(payload.sid, refreshToken);

    if (!sessionMatch) {
      throw new UnauthorizedException('\u0631\u0641\u0631\u0634 \u062a\u0648\u06a9\u0646 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }
    const { session } = sessionMatch;

    const user = await this.usersService.findByIdWithRoles(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('\u06a9\u0627\u0631\u0628\u0631 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }

    const roleKeys = user.userRoles.map((item) => item.role.key);

    const newAccessToken = this.signToken(
      {
        sub: user.id,
        username: user.username,
        sid: session.id,
        roles: roleKeys,
        type: 'access',
        jti: randomUUID()
      },
      this.accessTokenTtl
    );

    const newRefreshToken = this.signToken(
      {
        sub: user.id,
        username: user.username,
        sid: session.id,
        roles: roleKeys,
        type: 'refresh',
        jti: randomUUID()
      },
      this.refreshTokenTtl
    );

    await this.sessionsService.rotateSession(session.id, {
      refreshTokenHash: await argon2.hash(newRefreshToken),
      expiresAt: this.refreshTokenExpiryDate(),
      previousRefreshTokenHash: session.refreshTokenHash,
      previousRefreshValidUntil: new Date(Date.now() + this.refreshRotationGraceMs)
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(actorId: string, sessionId: string) {
    await this.sessionsService.revoke(actorId, sessionId);
    await this.operationLogsService.log({
      actorId,
      entityType: 'Auth',
      entityId: sessionId,
      action: 'LOGOUT',
      description: '\u062e\u0631\u0648\u062c \u06a9\u0627\u0631\u0628\u0631'
    });
    return { success: true };
  }

  async verifyAccessToken(token: string) {
    const payload = this.verifyToken(token, 'access');
    return {
      userId: payload.sub,
      username: payload.username,
      roleKeys: payload.roles,
      sessionId: payload.sid
    };
  }

  private async registerFailedLogin(username: string) {
    const old = await this.authRepository.findLoginAttempt(username);
    const nextFailed = (old?.failedCount ?? 0) + 1;
    const lockedUntil = nextFailed >= this.loginMaxAttempts ? new Date(Date.now() + this.loginLockMs) : null;
    await this.authRepository.upsertLoginAttempt(username, nextFailed >= this.loginMaxAttempts ? 0 : nextFailed, lockedUntil);
  }

  private assertLoginRateLimit(context: Record<string, string | undefined>) {
    const ip = this.extractClientIp(context);
    if (!ip) return;

    const now = Date.now();
    this.pruneLoginRateStore(now);

    const existing = this.loginRateByIp.get(ip);
    if (!existing || now - existing.windowStartedAt > this.loginRateWindowMs) {
      this.loginRateByIp.set(ip, { count: 1, windowStartedAt: now, blockedUntil: null });
      return;
    }

    if (existing.blockedUntil && existing.blockedUntil > now) {
      throw new UnauthorizedException('تلاش‌های ورود شما موقتاً محدود شده است. لطفاً بعداً دوباره تلاش کنید.');
    }

    const nextCount = existing.count + 1;
    if (nextCount > this.loginRateMaxAttempts) {
      this.loginRateByIp.set(ip, {
        count: 0,
        windowStartedAt: now,
        blockedUntil: now + this.loginRateLockMs
      });
      throw new UnauthorizedException('تلاش‌های ورود شما موقتاً محدود شده است. لطفاً بعداً دوباره تلاش کنید.');
    }

    this.loginRateByIp.set(ip, {
      ...existing,
      count: nextCount
    });
  }

  private pruneLoginRateStore(now: number) {
    if (this.loginRateByIp.size <= 5000) return;
    const staleBefore = now - this.loginRateWindowMs * 4;

    for (const [ip, state] of this.loginRateByIp.entries()) {
      const isBlocked = Boolean(state.blockedUntil && state.blockedUntil > now);
      if (isBlocked) continue;
      if (state.windowStartedAt < staleBefore) {
        this.loginRateByIp.delete(ip);
      }
    }
  }

  private extractClientIp(context: Record<string, string | undefined>) {
    const forwardedFor = context['x-forwarded-for']?.split(',')[0]?.trim();
    const realIp = context['x-real-ip']?.trim();
    const clientIp = context['x-client-ip']?.trim();
    const cloudflareIp = context['cf-connecting-ip']?.trim();
    const ip = forwardedFor || realIp || clientIp || cloudflareIp || context.ip?.trim();
    return ip || null;
  }

  private signToken(payload: AuthTokenPayload, expiresIn: string) {
    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS512',
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
      expiresIn: expiresIn as jwt.SignOptions['expiresIn']
    });
  }

  private verifyToken(token: string, expectedType: 'access' | 'refresh') {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS512'],
        issuer: this.jwtIssuer,
        audience: this.jwtAudience
      }) as AuthTokenPayload;

      if (payload.type !== expectedType) {
        throw new UnauthorizedException('\u0646\u0648\u0639 \u062a\u0648\u06a9\u0646 \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('\u062a\u0648\u06a9\u0646 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }
  }

  private refreshTokenExpiryDate() {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  private get jwtSecret() {
    return this.configService.get<string>('AUTH_JWT_SECRET') ?? 'change-this-super-secret';
  }

  private get jwtIssuer() {
    return this.configService.get<string>('AUTH_JWT_ISSUER') ?? 'best-api';
  }

  private get jwtAudience() {
    return this.configService.get<string>('AUTH_JWT_AUDIENCE') ?? 'best-dashboard';
  }

  private get accessTokenTtl() {
    return this.configService.get<string>('AUTH_JWT_ACCESS_TTL') ?? '15m';
  }

  private get refreshTokenTtl() {
    return this.configService.get<string>('AUTH_JWT_REFRESH_TTL') ?? '30d';
  }

  private get refreshRotationGraceMs() {
    const seconds = Number(this.configService.get<string>('AUTH_REFRESH_GRACE_SECONDS') ?? '1200');
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1_200_000;
  }

  private get loginMaxAttempts() {
    const value = Number(this.configService.get<string>('AUTH_LOGIN_MAX_ATTEMPTS') ?? '4');
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 4;
  }

  private get loginLockMs() {
    const minutes = Number(this.configService.get<string>('AUTH_LOGIN_LOCK_MINUTES') ?? '60');
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 3_600_000;
  }

  private get loginRateWindowMs() {
    const seconds = Number(this.configService.get<string>('AUTH_LOGIN_RATE_WINDOW_SECONDS') ?? '300');
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 300_000;
  }

  private get loginRateMaxAttempts() {
    const value = Number(this.configService.get<string>('AUTH_LOGIN_RATE_MAX_ATTEMPTS') ?? '30');
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 30;
  }

  private get loginRateLockMs() {
    const minutes = Number(this.configService.get<string>('AUTH_LOGIN_RATE_LOCK_MINUTES') ?? '15');
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 900_000;
  }
}
