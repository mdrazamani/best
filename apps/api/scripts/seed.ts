import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_SUPER_ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Best@123456';
  const firstName = process.env.SEED_SUPER_ADMIN_FIRSTNAME ?? '????';
  const lastName = process.env.SEED_SUPER_ADMIN_LASTNAME ?? '????';

  const superRole = await prisma.role.upsert({
    where: { key: 'super_admin' },
    update: {
      name: '???? ????',
      isSystem: true
    },
    create: {
      key: 'super_admin',
      name: '???? ????',
      description: '?????? ???? ?????',
      isSystem: true
    }
  });

  await prisma.role.upsert({
    where: { key: 'customer' },
    update: {
      name: '?????',
      isSystem: true
    },
    create: {
      key: 'customer',
      name: '?????',
      description: '??? ???????',
      isSystem: true
    }
  });

  const managerRole = await prisma.role.upsert({
    where: { key: 'manager' },
    update: {
      name: '????'
    },
    create: {
      key: 'manager',
      name: '????',
      description: '???? ?????',
      isSystem: false
    }
  });

  const permissionDefs = [
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
  ] as const;

  for (const item of permissionDefs) {
    const permission = await prisma.permission.upsert({
      where: { key: item.key },
      update: item,
      create: item
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: superRole.id,
        permissionId: permission.id
      }
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: managerRole.id,
        permissionId: permission.id
      }
    });
  }

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      firstName,
      lastName,
      passwordHash: await argon2.hash(password),
      status: 'ACTIVE',
      locale: 'fa'
    },
    create: {
      firstName,
      lastName,
      username,
      passwordHash: await argon2.hash(password),
      status: 'ACTIVE',
      locale: 'fa'
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superRole.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId: superRole.id
    }
  });

  console.log('Seed completed.');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
