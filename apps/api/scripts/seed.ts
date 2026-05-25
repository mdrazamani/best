import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_SUPER_ADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Best@123456';
  const firstName = process.env.SEED_SUPER_ADMIN_FIRSTNAME ?? '\u0645\u062f\u06cc\u0631';
  const lastName = process.env.SEED_SUPER_ADMIN_LASTNAME ?? '\u0627\u0635\u0644\u06cc';

  const superRole = await prisma.role.upsert({
    where: { key: 'super_admin' },
    update: {
      name: '\u0645\u062f\u06cc\u0631 \u0627\u0635\u0644\u06cc',
      isSystem: true
    },
    create: {
      key: 'super_admin',
      name: '\u0645\u062f\u06cc\u0631 \u0627\u0635\u0644\u06cc',
      description: '\u062f\u0633\u062a\u0631\u0633\u06cc \u06a9\u0627\u0645\u0644 \u0633\u06cc\u0633\u062a\u0645',
      isSystem: true
    }
  });

  await prisma.role.upsert({
    where: { key: 'customer' },
    update: {
      name: '\u0645\u0634\u062a\u0631\u06cc',
      isSystem: true
    },
    create: {
      key: 'customer',
      name: '\u0645\u0634\u062a\u0631\u06cc',
      description: '\u0646\u0642\u0634 \u067e\u06cc\u0634\u200c\u0641\u0631\u0636',
      isSystem: true
    }
  });

  const managerRole = await prisma.role.upsert({
    where: { key: 'manager' },
    update: {
      name: '\u0645\u062f\u06cc\u0631'
    },
    create: {
      key: 'manager',
      name: '\u0645\u062f\u06cc\u0631',
      description: '\u0645\u062f\u06cc\u0631 \u0633\u06cc\u0633\u062a\u0645',
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

  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        username,
        passwordHash: await argon2.hash(password),
        status: 'ACTIVE',
        locale: 'fa'
      }
    });
    console.log(`Created super admin: ${username}`);
  } else {
    console.log(`Super admin already exists: ${username}`);
  }

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
  console.log('Password left unchanged if the user already existed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
