import { NotFoundException } from '@nestjs/common';
import { OrdersService } from '../services/orders.service';

describe('OrdersService', () => {
  const ordersRepository = {
    list: jest.fn(),
    findById: jest.fn(),
    countByOrderPrefix: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn()
  };

  const operationLogsService = {
    log: jest.fn()
  };

  const invoicesService = {
    create: jest.fn()
  };

  const service = new OrdersService(ordersRepository as any, operationLogsService as any, invoicesService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters list by payment status', async () => {
    ordersRepository.list.mockResolvedValue([
      { id: '1', totalPrice: 1000, invoices: [{ paidAmount: 1000, amount: 1000 }] },
      { id: '2', totalPrice: 1000, invoices: [{ paidAmount: 400, amount: 500 }] },
      { id: '3', totalPrice: 1000, invoices: [] }
    ]);

    const result = await service.list({ paymentStatus: 'PARTIAL' } as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
    expect(result[0].paymentSummary.status).toBe('partial');
  });

  it('throws when order does not exist', async () => {
    ordersRepository.findById.mockResolvedValue(null);

    await expect(service.detail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes order on remove', async () => {
    ordersRepository.findById.mockResolvedValue({
      id: 'order-1',
      totalPrice: 100,
      invoices: []
    });

    const result = await service.remove('actor-1', 'order-1');

    expect(ordersRepository.softDelete).toHaveBeenCalledWith('order-1');
    expect(operationLogsService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        entityType: 'Order',
        entityId: 'order-1',
        action: 'DELETE'
      })
    );
    expect(result).toEqual({ success: true });
  });

  it('applies discount and extra amounts to auto invoice when creating order', async () => {
    ordersRepository.create.mockResolvedValue({
      id: 'order-1',
      collaboratorId: null,
      customerId: 'customer-1'
    });
    ordersRepository.findById.mockResolvedValue({
      id: 'order-1',
      totalPrice: 570,
      invoices: []
    });

    await service.create('actor-1', {
      customerId: 'customer-1',
      workType: 'NEW_CONSTRUCTION',
      lineItems: [{ meshTypeId: 'mesh-1', width: 2, height: 3, quantity: 1, unitPrice: 100 }],
      discountAmount: 50,
      extraAmount: 20
    } as any);

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPrice: 570,
        discountAmount: 50,
        extraAmount: 20
      })
    );

    expect(invoicesService.create).toHaveBeenCalledWith(
      'actor-1',
      expect.objectContaining({
        orderId: 'order-1',
        amount: 570,
        discountAmount: 50,
        extraAmount: 20
      })
    );
  });

  it('uses 10 percent vat by default when extra amount is not provided', async () => {
    ordersRepository.create.mockResolvedValue({
      id: 'order-2',
      collaboratorId: null,
      customerId: 'customer-1'
    });
    ordersRepository.findById.mockResolvedValue({
      id: 'order-2',
      totalPrice: 660,
      invoices: []
    });

    await service.create('actor-1', {
      customerId: 'customer-1',
      workType: 'NEW_CONSTRUCTION',
      lineItems: [{ meshTypeId: 'mesh-1', width: 2, height: 3, quantity: 1, unitPrice: 100 }]
    } as any);

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPrice: 660,
        extraAmount: 60
      })
    );

    expect(invoicesService.create).toHaveBeenCalledWith(
      'actor-1',
      expect.objectContaining({
        orderId: 'order-2',
        amount: 660,
        extraAmount: 60
      })
    );
  });
});
