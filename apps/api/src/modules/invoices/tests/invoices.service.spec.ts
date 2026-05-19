import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../services/invoices.service';

describe('InvoicesService', () => {
  const invoicesRepository = {
    list: jest.fn(),
    findById: jest.fn(),
    findForUpdate: jest.fn(),
    findOrdersForInvoice: jest.fn(),
    createWithOrders: jest.fn(),
    update: jest.fn(),
    addPayment: jest.fn(),
    softDelete: jest.fn()
  };

  const operationLogsService = {
    log: jest.fn()
  };

  const service = new InvoicesService(invoicesRepository as any, operationLogsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives PAID status when initial payment equals invoice amount', async () => {
    invoicesRepository.findOrdersForInvoice.mockResolvedValue([
      {
        id: 'order-1',
        orderNumber: 'OR-1',
        customerId: 'customer-1',
        collaboratorId: null,
        totalPrice: 1000,
        stage: 'IN_PROGRESS',
        invoiceLinks: []
      }
    ]);
    invoicesRepository.createWithOrders.mockResolvedValue({ id: 'inv-1' });
    invoicesRepository.findById.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'IN-1',
      amount: 1000,
      discountAmount: 0,
      paidAmount: 1000,
      status: 'PAID',
      createdAt: new Date(),
      orders: [{ order: { id: 'order-1', orderNumber: 'OR-1', lineItems: [] } }],
      payments: []
    });

    await service.create('actor-1', {
      orderIds: ['order-1'],
      amount: 1000,
      initialPaidAmount: 1000
    } as any);

    expect(invoicesRepository.createWithOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1000,
        paidAmount: 1000,
        status: 'PAID',
        orderIds: ['order-1']
      })
    );
  });

  it('rejects creating invoice when initialPaidAmount is greater than amount', async () => {
    invoicesRepository.findOrdersForInvoice.mockResolvedValue([
      {
        id: 'order-1',
        orderNumber: 'OR-1',
        customerId: 'customer-1',
        collaboratorId: null,
        totalPrice: 1000,
        stage: 'IN_PROGRESS',
        invoiceLinks: []
      }
    ]);

    await expect(
      service.create('actor-1', {
        orderIds: ['order-1'],
        amount: 1000,
        initialPaidAmount: 1000.5
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects status-only updates that conflict with payment history', async () => {
    invoicesRepository.findForUpdate.mockResolvedValue({
      id: 'inv-2',
      amount: 800,
      discountAmount: 0,
      paidAmount: 200,
      status: 'PARTIAL',
      payerType: 'CUSTOMER',
      payerId: 'customer-1',
      orders: [
        {
          orderId: 'order-1',
          order: {
            id: 'order-1',
            orderNumber: 'OR-1',
            collaboratorId: null,
            customerId: 'customer-1'
          }
        }
      ]
    });

    await expect(service.update('actor-1', 'inv-2', { status: 'UNPAID' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(invoicesRepository.update).not.toHaveBeenCalled();
  });

  it('throws when invoice does not exist on update', async () => {
    invoicesRepository.findForUpdate.mockResolvedValue(null);
    await expect(service.update('actor-1', 'missing', { status: 'PAID' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes invoice status in list output when stored status is stale', async () => {
    invoicesRepository.list.mockResolvedValue([{ id: 'inv-stale', amount: 200, paidAmount: 0, status: 'PAID', orders: [], payments: [] }]);

    const rows = await service.list({} as any);
    expect(rows[0].status).toBe('UNPAID');
  });

  it('rejects creating customer invoice when selected order has no customer', async () => {
    invoicesRepository.findOrdersForInvoice.mockResolvedValue([
      {
        id: 'order-2',
        orderNumber: 'OR-2',
        customerId: null,
        collaboratorId: 'col-1',
        totalPrice: 1000,
        stage: 'IN_PROGRESS',
        invoiceLinks: []
      }
    ]);

    await expect(
      service.create('actor-1', {
        orderIds: ['order-2'],
        payerType: 'CUSTOMER',
        payerId: 'customer-1'
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

