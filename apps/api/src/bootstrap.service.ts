import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RolesService } from './modules/roles/services/roles.service';
import { PermissionsService } from './modules/permissions/services/permissions.service';
import { UsersService } from './modules/users/services/users.service';

@Injectable()
export class BootstrapService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService
  ) {}

  async onModuleInit() {
    await this.rolesService.ensureSystemRoles();
    await this.permissionsService.ensureDefaultPermissions();
    await this.ensureSystemManager();
  }

  private async ensureSystemManager() {
    const isProduction = (this.configService.get<string>('NODE_ENV') ?? '').toLowerCase() === 'production';
    const username = (this.configService.get<string>('SEED_SUPER_ADMIN_USERNAME') ?? 'superadmin').trim();
    const configuredPassword = this.configService.get<string>('SEED_SUPER_ADMIN_PASSWORD')?.trim();
    const password = configuredPassword ?? (isProduction ? '' : 'Best@123456');
    const firstName = (this.configService.get<string>('SEED_SUPER_ADMIN_FIRSTNAME') ?? '\u0645\u062f\u06cc\u0631').trim();
    const lastName = (this.configService.get<string>('SEED_SUPER_ADMIN_LASTNAME') ?? '\u0627\u0635\u0644\u06cc').trim();

    if (!password) {
      throw new Error('SEED_SUPER_ADMIN_PASSWORD must be set in production.');
    }

    await this.usersService.createSystemManager({
      username,
      password,
      firstName,
      lastName
    });
  }
}
