import { NotFoundException } from '@nestjs/common';
import { OrdersService } from '../services/orders.service';

describe('OrdersService', () => {
  const ordersRepository = {
    list: jest.fn(),
    findById: jest.fn(),
    countByOrderPrefix: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };

  const operationLogsService = {
    log: jest.fn()
  };

  const service = new OrdersService(ordersRepository as any, operationLogsService as any);

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
});
