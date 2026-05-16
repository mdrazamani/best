import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { BaseService } from '../../../common/services/base.service';
import { RolesService } from '../../roles/services/roles.service';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersRepository } from '../users.repository';

@Injectable()
export class UsersService extends BaseService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
    private readonly operationLogsService: OperationLogsService,
    private readonly configService: ConfigService
  ) {
    super();
  }

  list() {
    return this.usersRepository.list();
  }

  async create(actorId: string, dto: CreateUserDto) {
    const normalizedUsername = dto.username.trim();
    const existing = await this.usersRepository.findByUsername(normalizedUsername);
    if (existing) {
      throw new BadRequestException('\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc \u0642\u0628\u0644\u0627\u064b \u062b\u0628\u062a \u0634\u062f\u0647 \u0627\u0633\u062a.');
    }

    const roleKey = dto.roleKey?.trim() || 'manager';
    if (!this.rolesService.getSystemRoleKeys().includes(roleKey as 'manager' | 'assistant')) {
      throw new BadRequestException('\u0646\u0642\u0634 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }

    const created = await this.usersRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      username: normalizedUsername,
      passwordHash: await argon2.hash(dto.password.trim()),
      locale: dto.locale ?? 'fa'
    });

    const role = await this.rolesService.findByKey(roleKey);
    if (role) {
      await this.usersRepository.addRole(created.id, role.id);
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'User',
      entityId: created.id,
      action: 'CREATE',
      description: '\u0627\u06cc\u062c\u0627\u062f \u06a9\u0627\u0631\u0628\u0631'
    });

    return this.usersRepository.findById(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('\u06a9\u0627\u0631\u0628\u0631 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }

    const updated = await this.usersRepository.update(id, {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      username: dto.username?.trim(),
      passwordHash: dto.password?.trim() ? await argon2.hash(dto.password.trim()) : undefined,
      status: dto.status,
      locale: dto.locale
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'User',
      entityId: updated.id,
      action: 'UPDATE',
      description: '\u0648\u06cc\u0631\u0627\u06cc\u0634 \u06a9\u0627\u0631\u0628\u0631'
    });

    return this.usersRepository.findById(updated.id);
  }

  async assignRole(actorId: string, userId: string, roleKey: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('\u06a9\u0627\u0631\u0628\u0631 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }

    const normalizedRoleKey = roleKey.trim();
    if (!this.rolesService.getSystemRoleKeys().includes(normalizedRoleKey as 'manager' | 'assistant')) {
      throw new BadRequestException('\u0646\u0642\u0634 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
    }

    const role = await this.rolesService.findByKey(normalizedRoleKey);
    if (!role) {
      throw new NotFoundException('\u0646\u0642\u0634 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }

    await this.usersRepository.addRole(userId, role.id);

    await this.operationLogsService.log({
      actorId,
      entityType: 'UserRole',
      entityId: userId,
      action: 'ASSIGN_ROLE',
      description: `\u0627\u062e\u062a\u0635\u0627\u0635 \u0646\u0642\u0634 ${role.name}`
    });

    return this.usersRepository.findById(userId);
  }

  async remove(actorId: string, id: string) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('\u06a9\u0627\u0631\u0628\u0631 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.');
    }

    const protectedManagerUsername = (this.configService.get<string>('SEED_SUPER_ADMIN_USERNAME') ?? 'superadmin').trim().toLowerCase();
    const isDefaultManager = existing.username.trim().toLowerCase() === protectedManagerUsername;
    if (isDefaultManager) {
      throw new BadRequestException('\u062d\u0630\u0641 \u06a9\u0627\u0631\u0628\u0631 \u0645\u062f\u06cc\u0631 \u0627\u0635\u0644\u06cc \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a.');
    }

    await this.usersRepository.softDelete(id);

    await this.operationLogsService.log({
      actorId,
      entityType: 'User',
      entityId: id,
      action: 'DELETE',
      description: 'حذف کاربر'
    });

    return { success: true };
  }

  findByIdWithRoles(id: string) {
    return this.usersRepository.findById(id);
  }

  findByUsernameWithRoles(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async createSystemManager(input: { firstName: string; lastName: string; username: string; password: string }) {
    const existing = await this.usersRepository.findByUsername(input.username.trim());
    if (existing) {
      return existing;
    }

    const created = await this.usersRepository.create({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: input.username.trim(),
      passwordHash: await argon2.hash(input.password.trim()),
      locale: 'fa',
      status: 'ACTIVE'
    });

    const role = await this.rolesService.findByKey('manager');
    if (role) {
      await this.usersRepository.addRole(created.id, role.id);
    }

    return this.usersRepository.findById(created.id);
  }
}
