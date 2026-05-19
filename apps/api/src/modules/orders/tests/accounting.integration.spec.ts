import { BadRequestException } from '@nestjs/common';
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
    customerId: 'customer-1',
    collaboratorId: 'col-1',
    stage: 'IN_PROGRESS',
    createdAt: new Date('2026-01-01T00:00:00.000Z')
  };

  let orderState: any;
  let invoicesState: any[];
  let paymentsState: any[];

  const ordersRepository = {
    list: jest.fn(async () => []),
    findById: jest.fn(async (id: string) => {
      if (id !== orderState.id) return null;
      const activeInvoices = invoicesState.filter((item) => !item.deletedAt && item.orderIds.includes(orderState.id));
      return {
        ...orderState,
        invoiceLinks: activeInvoices.map((invoice) => ({
          invoice: {
            id: invoice.id,
            amount: invoice.amount,
            paidAmount: invoice.paidAmount,
            status: invoice.status
          }
        }))
      };
    }),
    createWithInitialInvoice: jest.fn(),
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
        orders: invoice.orderIds.map((orderId: string) => ({
          orderId,
          order: {
            ...orderState,
            id: orderId,
            lineItems: []
          }
        })),
        payments: paymentsState
          .filter((payment) => payment.invoiceId === id)
          .map((payment) => ({
            ...payment,
            createdBy: { id: payment.createdById, firstName: 'A', lastName: 'B', username: 'ab' }
          }))
      };
    }),
    findForUpdate: jest.fn(async (id: string) => {
      const invoice = invoicesState.find((item) => item.id === id && !item.deletedAt);
      if (!invoice) return null;
      return {
        ...invoice,
        orders: invoice.orderIds.map((orderId: string) => ({
          orderId,
          order: {
            id: orderId,
            orderNumber: orderState.orderNumber,
            collaboratorId: orderState.collaboratorId,
            customerId: orderState.customerId,
            stage: orderState.stage,
            deletedAt: null
          }
        }))
      };
    }),
    findOrdersForInvoice: jest.fn(async (orderIds: string[]) => {
      if (!orderIds.includes(orderState.id)) return [];
      const linked = invoicesState
        .filter((invoice) => !invoice.deletedAt && invoice.orderIds.includes(orderState.id))
        .map((invoice) => ({ invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber } }));
      return [
        {
          ...orderState,
          invoiceLinks: linked
        }
      ];
    }),
    createWithOrders: jest.fn(async (data: any) => {
      const invoice = {
        id: `inv-${invoicesState.length + 1}`,
        createdAt: new Date(2026, 0, invoicesState.length + 1),
        deletedAt: null,
        ...data
      };
      invoicesState.push(invoice);
      if (data.initialPayment) {
        paymentsState.push({
          id: `pay-${paymentsState.length + 1}`,
          invoiceId: invoice.id,
          amount: data.initialPayment.amount,
          paidAt: data.initialPayment.paidAt,
          note: data.initialPayment.note,
          createdById: data.initialPayment.createdById
        });
      }
      return invoice;
    }),
    update: jest.fn(),
    addPayment: jest.fn(async (data: any) => {
      paymentsState.push({
        id: `pay-${paymentsState.length + 1}`,
        invoiceId: data.invoiceId,
        amount: data.amount,
        paidAt: data.paidAt,
        note: data.note,
        createdById: data.createdById
      });
      const idx = invoicesState.findIndex((item) => item.id === data.invoiceId);
      invoicesState[idx] = {
        ...invoicesState[idx],
        paidAmount: data.nextPaidAmount,
        status: data.nextStatus,
        paidAt: data.invoicePaidAt
      };
      return { id: `pay-${paymentsState.length}` };
    }),
    softDelete: jest.fn()
  };

  const invoicesService = new InvoicesService(invoicesRepository as any, operationLogsService as any);
  const ordersService = new OrdersService(ordersRepository as any, operationLogsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
    orderState = { ...baseOrder };
    invoicesState = [];
    paymentsState = [];
  });

  it('enforces one invoice per order and keeps payment summary accurate after payments', async () => {
    const createdInvoice = await invoicesService.create('actor-1', {
      orderIds: [orderState.id],
      amount: 1000,
      initialPaidAmount: 600
    } as any);

    expect(createdInvoice?.id).toBeTruthy();

    const partialSummary = await ordersService.detail(orderState.id);
    expect(partialSummary.paymentSummary.total).toBe(1000);
    expect(partialSummary.paymentSummary.paidAmount).toBe(600);
    expect(partialSummary.paymentSummary.remainingAmount).toBe(400);
    expect(partialSummary.paymentSummary.status).toBe('partial');

    await expect(
      invoicesService.create('actor-1', {
        orderIds: [orderState.id],
        amount: 100
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);

    await invoicesService.addPayment('actor-1', createdInvoice.id, { amount: 400 } as any);

    const paidSummary = await ordersService.detail(orderState.id);
    expect(paidSummary.paymentSummary.total).toBe(1000);
    expect(paidSummary.paymentSummary.paidAmount).toBe(1000);
    expect(paidSummary.paymentSummary.remainingAmount).toBe(0);
    expect(paidSummary.paymentSummary.status).toBe('paid');

    await expect(invoicesService.addPayment('actor-1', createdInvoice.id, { amount: 1 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
