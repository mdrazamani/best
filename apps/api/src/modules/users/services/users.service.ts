import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    private readonly operationLogsService: OperationLogsService
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
      throw new BadRequestException('??? ?????? ???? ??? ??? ???.');
    }

    const created = await this.usersRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      username: normalizedUsername,
      passwordHash: await argon2.hash(dto.password.trim()),
      locale: dto.locale ?? 'fa'
    });

    const role = await this.rolesService.findByKey(dto.roleKey?.trim() || 'manager');
    if (role) {
      await this.usersRepository.addRole(created.id, role.id);
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'User',
      entityId: created.id,
      action: 'CREATE',
      description: '????? ????? ???????'
    });

    return this.usersRepository.findById(created.id);
  }

  async update(actorId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('????? ???? ???.');
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
      description: '?????? ????? ???????'
    });

    return this.usersRepository.findById(updated.id);
  }

  async assignRole(actorId: string, userId: string, roleKey: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('????? ???? ???.');
    }

    const role = await this.rolesService.findByKey(roleKey.trim());
    if (!role) {
      throw new NotFoundException('??? ???? ???.');
    }

    await this.usersRepository.addRole(userId, role.id);

    await this.operationLogsService.log({
      actorId,
      entityType: 'UserRole',
      entityId: userId,
      action: 'ASSIGN_ROLE',
      description: `?????? ??? ${role.name}`
    });

    return this.usersRepository.findById(userId);
  }

  findByIdWithRoles(id: string) {
    return this.usersRepository.findById(id);
  }

  findByUsernameWithRoles(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async createSystemSuperAdmin(input: { firstName: string; lastName: string; username: string; password: string }) {
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

    const role = await this.rolesService.findByKey('super_admin');
    if (role) {
      await this.usersRepository.addRole(created.id, role.id);
    }

    return this.usersRepository.findById(created.id);
  }
}
