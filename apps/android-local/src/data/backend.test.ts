import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserBackend, prepareSnapshotForImport } from './backend';
import type { AppSnapshot, Collaborator, Customer, Invoice, Order } from './types';

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    customers: [],
    orders: [],
    invoices: [],
    collaboratorPayments: [],
    inventory: [],
    collaborators: [],
    meshTypes: [],
    users: [],
    notifications: [],
    activities: [],
    ...overrides
  };
}

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    }
  });
}

const createdAt = '2026-07-20T00:00:00.000Z';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-1',
    name: 'Customer',
    phone: '',
    address: '',
    note: '',
    createdAt,
    ...overrides
  };
}

function collaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: 'collaborator-1',
    name: 'Collaborator',
    phone: '',
    role: 'Installer',
    note: '',
    createdAt,
    ...overrides
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    customerName: 'Customer',
    collaboratorId: 'collaborator-1',
    collaboratorName: 'Collaborator',
    title: 'Order',
    status: 'received',
    workType: 'new_construction',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    total: 0,
    lineItems: [],
    dueDate: '',
    note: '',
    createdAt,
    ...overrides
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    invoiceNumber: 'INV-1',
    orderId: 'order-1',
    orderIds: ['order-1'],
    orderTitle: 'Order',
    customerName: 'Customer',
    payerId: 'collaborator-1',
    payerName: 'Collaborator',
    title: 'Invoice',
    amount: 1000,
    paid: 0,
    discount: 0,
    status: 'unpaid',
    dueDate: '',
    note: '',
    createdAt,
    ...overrides
  };
}

describe('local backend safety', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with clean data when browser storage is not valid JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.localStorage.setItem('best-mobile-local-backend-v2', '{not-json');

    const backend = new BrowserBackend();
    await backend.initialize();

    const data = await backend.snapshot();
    expect(data.customers).toHaveLength(0);
    expect(data.users).toHaveLength(1);
  });

  it('does not save stale collaborator referrals when creating or updating customers', async () => {
    const backend = new BrowserBackend();
    await backend.initialize();
    const existingCollaborator = await backend.addCollaborator({ name: 'Installer' });
    const customerWithMissingReferral = await backend.addCustomer({ name: 'Customer 1', referredByCollaboratorId: 'missing-collaborator' });
    const customerWithValidReferral = await backend.addCustomer({ name: 'Customer 2', referredByCollaboratorId: existingCollaborator.id });

    await backend.updateCustomer({ id: customerWithValidReferral.id, referredByCollaboratorId: 'missing-collaborator' });

    const data = await backend.snapshot();
    expect(data.customers.find((item) => item.id === customerWithMissingReferral.id)?.referredByCollaboratorId).toBe('');
    expect(data.customers.find((item) => item.id === customerWithValidReferral.id)?.referredByCollaboratorId).toBe('');
  });

  it('clears customer collaborator referrals when deleting a collaborator', async () => {
    const backend = new BrowserBackend();
    await backend.initialize();
    const collaborator = await backend.addCollaborator({ name: 'Installer', phone: '0912' });
    const customer = await backend.addCustomer({ name: 'Customer', referredByCollaboratorId: collaborator.id });

    await backend.deleteCollaborator(collaborator.id);

    const data = await backend.snapshot();
    expect(data.customers.find((item) => item.id === customer.id)?.referredByCollaboratorId).toBe('');
    expect(data.collaborators).toHaveLength(0);
  });

  it('does not delete customers that still have orders', async () => {
    const backend = new BrowserBackend();
    await backend.initialize();
    const collaborator = await backend.addCollaborator({ name: 'Installer' });
    const customer = await backend.addCustomer({ name: 'Customer' });
    await backend.addOrder({ customerId: customer.id, collaboratorId: collaborator.id, title: 'Order' });

    await expect(backend.deleteCustomer(customer.id)).rejects.toThrow();

    const data = await backend.snapshot();
    expect(data.customers.map((item) => item.id)).toContain(customer.id);
    expect(data.orders).toHaveLength(1);
  });

  it('deletes invoices that reference a deleted order', async () => {
    const backend = new BrowserBackend();
    await backend.initialize();
    const collaborator = await backend.addCollaborator({ name: 'Installer' });
    const customer = await backend.addCustomer({ name: 'Customer' });
    await backend.addOrder({ customerId: customer.id, collaboratorId: collaborator.id, title: 'Order', createInitialInvoice: true });
    const existingOrder = (await backend.snapshot()).orders[0];

    await backend.deleteOrder(existingOrder.id);

    const data = await backend.snapshot();
    expect(data.orders).toHaveLength(0);
    expect(data.invoices).toHaveLength(0);
  });

  it('does not save stale invoice payers when editing invoices', async () => {
    const backend = new BrowserBackend();
    await backend.initialize();
    const collaborator = await backend.addCollaborator({ name: 'Installer' });
    const customer = await backend.addCustomer({ name: 'Customer' });
    await backend.addOrder({ customerId: customer.id, collaboratorId: collaborator.id, title: 'Order', createInitialInvoice: true });
    const existingInvoice = (await backend.snapshot()).invoices[0];

    await backend.updateInvoice({ id: existingInvoice.id, payerId: 'missing-collaborator' });

    const data = await backend.snapshot();
    expect(data.invoices[0]?.payerId).toBe('');
    expect(data.invoices[0]?.payerName).toBe('');
  });

  it('rejects invalid imports before replacing existing local data', async () => {
    const backend = new BrowserBackend();
    await backend.initialize();
    const existing = await backend.addCustomer({ name: 'Existing customer' });

    await expect(backend.importSnapshot(snapshot({
      orders: [{
        id: 'order-without-customer',
        customerId: 'missing-customer',
        customerName: '',
        collaboratorId: '',
        collaboratorName: '',
        title: 'Broken order',
        status: 'received',
        workType: 'new_construction',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        total: 0,
        lineItems: [],
        dueDate: '',
        note: '',
        createdAt: '2026-07-20T00:00:00.000Z'
      }]
    }))).rejects.toThrow('سفارش بدون مشتری');

    const data = await backend.snapshot();
    expect(data.customers.map((item) => item.id)).toContain(existing.id);
  });

  it('rejects invoices that point to missing orders', () => {
    expect(() => prepareSnapshotForImport(snapshot({
      invoices: [{
        id: 'invoice-1',
        invoiceNumber: 'INV-1',
        orderId: 'missing-order',
        orderIds: ['missing-order'],
        orderTitle: '',
        customerName: '',
        payerId: '',
        payerName: '',
        title: 'Broken invoice',
        amount: 1000,
        paid: 0,
        discount: 0,
        status: 'unpaid',
        dueDate: '',
        note: '',
        createdAt: '2026-07-20T00:00:00.000Z'
      }]
    }))).toThrow('فاکتور بدون سفارش');
  });

  it('accepts older backups that do not contain optional arrays', () => {
    const prepared = prepareSnapshotForImport({
      customers: [customer()],
      collaborators: [collaborator()],
      orders: [order()],
      invoices: [invoice()],
      inventory: [],
      meshTypes: []
    } as unknown as AppSnapshot);

    expect(prepared.collaboratorPayments).toEqual([]);
    expect(prepared.users).toEqual([]);
    expect(prepared.notifications).toEqual([]);
    expect(prepared.activities).toEqual([]);
  });

  it('rejects backups that do not contain required arrays', () => {
    expect(() => prepareSnapshotForImport({
      collaborators: [],
      orders: [],
      invoices: [],
      collaboratorPayments: [],
      inventory: [],
      meshTypes: [],
      users: [],
      notifications: [],
      activities: []
    } as unknown as AppSnapshot)).toThrow('customers');
  });

  it('rejects collaborator payments that point to missing collaborators', () => {
    expect(() => prepareSnapshotForImport(snapshot({
      collaboratorPayments: [{
        id: 'payment-1',
        collaboratorId: 'missing-collaborator',
        collaboratorName: '',
        amount: 1000,
        paidAt: '2026-07-20',
        note: '',
        createdAt: '2026-07-20T00:00:00.000Z'
      }]
    }))).toThrow('پرداخت بدون همکار');
  });

  it('rejects duplicated ids in imported data', () => {
    const customer = {
      id: 'customer-1',
      name: 'Customer',
      phone: '',
      address: '',
      note: '',
      createdAt: '2026-07-20T00:00:00.000Z'
    };

    expect(() => prepareSnapshotForImport(snapshot({
      customers: [customer, customer]
    }))).toThrow('شناسه تکراری');
  });

  it('sanitizes stale optional collaborator references during import', () => {
    const prepared = prepareSnapshotForImport(snapshot({
      customers: [{
        id: 'customer-1',
        name: 'Customer',
        phone: '',
        address: '',
        note: '',
        referredByCollaboratorId: 'deleted-collaborator',
        createdAt: '2026-07-20T00:00:00.000Z'
      }]
    }));

    expect(prepared.customers[0]?.referredByCollaboratorId).toBe('');
  });
});
