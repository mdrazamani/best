import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { PermissionsService } from '../../modules/permissions/services/permissions.service';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService
  ) {}

  async canActivate(context: ExecutionContext) {
    const needed = this.reflector.get<string | undefined>(PERMISSION_KEY, context.getHandler());
    if (!needed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('کاربر احراز هویت نشده است.');
    }

    if (user.roleKeys.includes('manager')) {
      return true;
    }

    const allowed = await this.permissionsService.hasPermission(user.userId, needed);
    if (!allowed) {
      throw new ForbiddenException('شما دسترسی لازم برای این عملیات را ندارید.');
    }

    return true;
  }
}
