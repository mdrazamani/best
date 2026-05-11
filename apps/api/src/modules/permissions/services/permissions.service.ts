import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { PermissionsRepository } from '../permissions.repository';
import { RolesService } from '../../roles/services/roles.service';

@Injectable()
export class PermissionsService extends BaseService {
  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly rolesService: RolesService
  ) {
    super();
  }

  list() {
    return this.permissionsRepository.findAll();
  }

  async hasPermission(userId: string, permissionKey: string) {
    const found = await this.permissionsRepository.findUserPermission(userId, permissionKey);
    return Boolean(found);
  }

  async setRolePermissions(roleKey: string, permissionKeys: string[]) {
    const role = await this.rolesService.findByKey(roleKey);
    if (!role) {
      throw new NotFoundException('??? ???? ???.');
    }

    if (role.isSystem && role.key === 'super_admin') {
      throw new BadRequestException('?????? ??? ???? ???? ???? ????? ????.');
    }

    const uniqueKeys = Array.from(new Set(permissionKeys.map((item) => item.trim()).filter(Boolean)));
    const permissions = await this.permissionsRepository.listByKeys(uniqueKeys);

    if (permissions.length !== uniqueKeys.length) {
      throw new BadRequestException('???? ??????? ?????? ??????? ?????.');
    }

    await this.permissionsRepository.syncRolePermissions(
      role.id,
      permissions.map((permission) => permission.id)
    );

    return {
      roleKey: role.key,
      permissionKeys: permissions.map((permission) => permission.key)
    };
  }

  async ensureDefaultPermissions() {
    const defaults = [
      { key: 'roles.list', resource: 'roles', apiName: 'ListRoles', method: 'GET', path: '/roles' },
      { key: 'roles.manage', resource: 'roles', apiName: 'ManageRolePermissions', method: 'PUT', path: '/permissions/roles/:roleKey' },
      { key: 'permissions.list', resource: 'permissions', apiName: 'ListPermissions', method: 'GET', path: '/permissions' },
      { key: 'users.list', resource: 'users', apiName: 'ListUsers', method: 'GET', path: '/users' },
      { key: 'users.create', resource: 'users', apiName: 'CreateUser', method: 'POST', path: '/users' },
      { key: 'collaborators.all', resource: 'collaborators', apiName: 'Collaborators', method: 'ANY', path: '/collaborators' },
      { key: 'customers.all', resource: 'customers', apiName: 'Customers', method: 'ANY', path: '/customers' },
      { key: 'mesh_types.all', resource: 'mesh_types', apiName: 'MeshTypes', method: 'ANY', path: '/mesh-types' },
      { key: 'orders.all', resource: 'orders', apiName: 'Orders', method: 'ANY', path: '/orders' },
      { key: 'invoices.all', resource: 'invoices', apiName: 'Invoices', method: 'ANY', path: '/invoices' },
      { key: 'backups.all', resource: 'backups', apiName: 'Backups', method: 'ANY', path: '/backups' },
      { key: 'reports.all', resource: 'reports', apiName: 'Reports', method: 'ANY', path: '/reports' },
      { key: 'logs.list', resource: 'operation_logs', apiName: 'Logs', method: 'GET', path: '/operation-logs' }
    ];

    const permissionIds: string[] = [];
    for (const item of defaults) {
      const existing = await this.permissionsRepository.findByKey(item.key);
      const permission = existing ?? (await this.permissionsRepository.create(item));
      permissionIds.push(permission.id);
    }

    const superAdminRole = await this.rolesService.findByKey('super_admin');
    if (superAdminRole) {
      for (const permissionId of permissionIds) {
        await this.permissionsRepository.rolePermissionAssign(superAdminRole.id, permissionId);
      }
    }

    const managerRole = await this.rolesService.findByKey('manager');
    if (managerRole) {
      for (const permissionId of permissionIds) {
        await this.permissionsRepository.rolePermissionAssign(managerRole.id, permissionId);
      }
    }
  }
}
