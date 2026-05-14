import { InvoicesService } from '../../invoices/services/invoices.service';
import { OrdersService } from '../services/orders.service';

describe('Accounting integration (orders + invoices)', () => {
  const operationLogsService = {
    log: jest.fn()
  };

  const baseOrder = {
    id: 'order-1',
    orderNumber: 'OR-TEST-1',
    title: 'Test order',
    totalPrice: 1000,
    discountAmount: 0,
    extraAmount: 0,
    customerId: 'customer-1',
    collaboratorId: null
  };

  let orderState: any;
  let invoicesState: any[];

  const ordersRepository = {
    list: jest.fn(async () => []),
    findById: jest.fn(async (id: string) => {
      if (id !== orderState.id) return null;
      return {
        ...orderState,
        invoices: invoicesState.filter((item) => !item.deletedAt).map((item) => ({ amount: item.amount, paidAmount: item.paidAmount }))
      };
    }),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn()
  };

  const invoicesRepository = {
    list: jest.fn(),
    findById: jest.fn(async (id: string) => {
      const invoice = invoicesState.find((item) => item.id === id && !item.deletedAt);
      if (!invoice) return null;
      return {
        ...invoice,
        order: {
          ...orderState,
          customer: { id: 'customer-1', firstName: 'A', lastName: 'B' },
          collaborator: null,
          lineItems: [],
          invoices: invoicesState
            .filter((item) => !item.deletedAt)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((item) => ({ id: item.id, amount: item.amount, createdAt: item.createdAt }))
        }
      };
    }),
    findOrderForPayer: jest.fn(async (orderId: string) => {
      if (orderId !== orderState.id) return null;
      return {
        id: orderState.id,
        customerId: orderState.customerId,
        collaboratorId: orderState.collaboratorId,
        totalPrice: orderState.totalPrice
      };
    }),
    create: jest.fn(async (data: any) => {
      const invoice = {
        id: `inv-${invoicesState.length + 1}`,
        createdAt: new Date(2026, 0, invoicesState.length + 1),
        deletedAt: null,
        ...data
      };
      invoicesState.push(invoice);
      return invoice;
    }),
    update: jest.fn(async (id: string, data: any) => {
      const idx = invoicesState.findIndex((item) => item.id === id && !item.deletedAt);
      if (idx >= 0) {
        const sanitizedUpdate = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
        invoicesState[idx] = { ...invoicesState[idx], ...sanitizedUpdate };
      }
      return invoicesState[idx];
    }),
    softDelete: jest.fn(async (id: string) => {
      const idx = invoicesState.findIndex((item) => item.id === id && !item.deletedAt);
      if (idx >= 0) invoicesState[idx].deletedAt = new Date();
    })
  };

  const invoicesService = new InvoicesService(invoicesRepository as any, operationLogsService as any);
  const ordersService = new OrdersService(ordersRepository as any, operationLogsService as any, invoicesService as any);

  beforeEach(() => {
    jest.clearAllMocks();
    orderState = { ...baseOrder };
    invoicesState = [];
  });

  it('keeps debt/remaining amount accurate after multiple invoice operations', async () => {
    await invoicesService.create('actor-1', {
      orderId: orderState.id,
      amount: 600,
      paidAmount: 600,
      status: 'PAID'
    } as any);

    const secondInvoice = await invoicesService.create('actor-1', {
      orderId: orderState.id,
      amount: 400,
      status: 'UNPAID'
    } as any);
    expect(secondInvoice?.id).toBeTruthy();
    expect(invoicesRepository.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        amount: 400,
        paidAmount: 0,
        status: 'UNPAID'
      })
    );

    const partialSummary = await ordersService.detail(orderState.id);
    expect(partialSummary.paymentSummary.total).toBe(1000);
    expect(partialSummary.paymentSummary.paidAmount).toBe(600);
    expect(partialSummary.paymentSummary.remainingAmount).toBe(400);
    expect(partialSummary.paymentSummary.status).toBe('partial');

    await invoicesService.update('actor-1', secondInvoice!.id, { status: 'PAID' } as any);
    expect(invoicesRepository.update).toHaveBeenLastCalledWith(
      secondInvoice!.id,
      expect.objectContaining({
        paidAmount: 400,
        status: 'PAID'
      })
    );
    expect(invoicesState.map((item) => ({ amount: item.amount, paidAmount: item.paidAmount }))).toEqual([
      { amount: 600, paidAmount: 600 },
      { amount: 400, paidAmount: 400 }
    ]);

    const paidSummary = await ordersService.detail(orderState.id);
    expect(paidSummary.paymentSummary.total).toBe(1000);
    expect(paidSummary.paymentSummary.paidAmount).toBe(1000);
    expect(paidSummary.paymentSummary.remainingAmount).toBe(0);
    expect(paidSummary.paymentSummary.status).toBe('paid');
  });
});
