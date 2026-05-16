import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionsService } from '../services/permissions.service';

describe('PermissionsService', () => {
  const permissionsRepository = {
    findAll: jest.fn(),
    findUserPermission: jest.fn(),
    listByKeys: jest.fn(),
    syncRolePermissions: jest.fn(),
    findByKey: jest.fn(),
    create: jest.fn(),
    rolePermissionAssign: jest.fn()
  };

  const rolesService = {
    findByKey: jest.fn()
  };

  const service = new PermissionsService(permissionsRepository as any, rolesService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFound for unknown role', async () => {
    rolesService.findByKey.mockResolvedValue(null);

    await expect(service.setRolePermissions('x', [])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents editing manager permissions', async () => {
    rolesService.findByKey.mockResolvedValue({ id: '1', key: 'manager', isSystem: true });

    await expect(service.setRolePermissions('manager', ['users.list'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('syncs permissions for normal role', async () => {
    rolesService.findByKey.mockResolvedValue({ id: 'r1', key: 'assistant', isSystem: true });
    permissionsRepository.listByKeys.mockResolvedValue([
      { id: 'p1', key: 'users.list' },
      { id: 'p2', key: 'orders.all' }
    ]);

    const result = await service.setRolePermissions('assistant', ['users.list', 'orders.all']);

    expect(permissionsRepository.syncRolePermissions).toHaveBeenCalledWith('r1', ['p1', 'p2']);
    expect(result.permissionKeys).toEqual(['users.list', 'orders.all']);
  });
});
