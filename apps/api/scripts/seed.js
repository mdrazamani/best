const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const LABELS = {
  firstName: '\u0645\u062f\u06cc\u0631',
  lastName: '\u0627\u0635\u0644\u06cc',
  superAdminName: '\u0645\u062f\u06cc\u0631 \u0627\u0635\u0644\u06cc',
  superAdminDescription: '\u062f\u0633\u062a\u0631\u0633\u06cc \u06a9\u0627\u0645\u0644 \u0633\u06cc\u0633\u062a\u0645',
  customerName: '\u0645\u0634\u062a\u0631\u06cc',
  customerDescription: '\u0646\u0642\u0634 \u067e\u06cc\u0634\u200c\u0641\u0631\u0636',
  managerName: '\u0645\u062f\u06cc\u0631',
  managerDescription: '\u0645\u062f\u06cc\u0631 \u0633\u06cc\u0633\u062a\u0645'
};

async function main() {
  const username = process.env.SEED_SUPER_ADMIN_USERNAME || 'superadmin';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Best@123456';
  const firstName = process.env.SEED_SUPER_ADMIN_FIRSTNAME || LABELS.firstName;
  const lastName = process.env.SEED_SUPER_ADMIN_LASTNAME || LABELS.lastName;

  const superRole = await prisma.role.upsert({
    where: { key: 'super_admin' },
    update: { name: LABELS.superAdminName, isSystem: true },
    create: {
      key: 'super_admin',
      name: LABELS.superAdminName,
      description: LABELS.superAdminDescription,
      isSystem: true
    }
  });

  await prisma.role.upsert({
    where: { key: 'customer' },
    update: { name: LABELS.customerName, isSystem: true },
    create: {
      key: 'customer',
      name: LABELS.customerName,
      description: LABELS.customerDescription,
      isSystem: true
    }
  });

  const managerRole = await prisma.role.upsert({
    where: { key: 'manager' },
    update: { name: LABELS.managerName },
    create: {
      key: 'manager',
      name: LABELS.managerName,
      description: LABELS.managerDescription,
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
  ];

  for (const item of permissionDefs) {
    const permission = await prisma.permission.upsert({
      where: { key: item.key },
      update: item,
      create: item
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: superRole.id, permissionId: permission.id }
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: managerRole.id, permissionId: permission.id }
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
