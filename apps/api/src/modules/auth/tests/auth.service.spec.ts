import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

describe('AuthService', () => {
  const usersService = {
    findByUsernameWithRoles: jest.fn(),
    findByIdWithRoles: jest.fn()
  };

  const sessionsService = {
    createSession: jest.fn(),
    rotateSession: jest.fn(),
    verifyRefreshToken: jest.fn(),
    revoke: jest.fn()
  };

  const authRepository = {
    findLoginAttempt: jest.fn(),
    resetLoginAttempt: jest.fn(),
    upsertLoginAttempt: jest.fn()
  };

  const operationLogsService = {
    log: jest.fn()
  };

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        AUTH_JWT_SECRET: 'test-secret',
        AUTH_JWT_ISSUER: 'best-api',
        AUTH_JWT_AUDIENCE: 'best-dashboard',
        AUTH_JWT_ACCESS_TTL: '15m',
        AUTH_JWT_REFRESH_TTL: '30d'
      };
      return values[key];
    })
  } as unknown as ConfigService;

  const service = new AuthService(
    configService,
    usersService as any,
    sessionsService as any,
    authRepository as any,
    operationLogsService as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects locked user login', async () => {
    authRepository.findLoginAttempt.mockResolvedValue({ lockedUntil: new Date(Date.now() + 60_000) });

    await expect(service.login({ username: 'admin', password: '123456', context: {} })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns access and refresh tokens on valid login', async () => {
    authRepository.findLoginAttempt.mockResolvedValue(null);
    usersService.findByUsernameWithRoles.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      status: 'ACTIVE',
      passwordHash: 'hashed:123456',
      firstName: 'Ali',
      lastName: 'Best',
      userRoles: [{ role: { key: 'super_admin' } }]
    });
    sessionsService.createSession.mockResolvedValue({ id: 's1' });

    const result = await service.login({ username: 'admin', password: '123456', context: {} });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(sessionsService.rotateSession).toHaveBeenCalled();
    expect(operationLogsService.log).toHaveBeenCalled();
  });
});
