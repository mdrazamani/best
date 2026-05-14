import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../services/invoices.service';

describe('InvoicesService', () => {
  const invoicesRepository = {
    list: jest.fn(),
    findById: jest.fn(),
    findOrderForPayer: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn()
  };

  const operationLogsService = {
    log: jest.fn()
  };

  const service = new InvoicesService(invoicesRepository as any, operationLogsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-fills paidAmount when creating PAID invoice without paidAmount', async () => {
    invoicesRepository.findOrderForPayer.mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      collaboratorId: null,
      totalPrice: 1000
    });
    invoicesRepository.create.mockResolvedValue({
      id: 'inv-1',
      orderId: 'order-1'
    });
    invoicesRepository.findById.mockResolvedValue({
      id: 'inv-1',
      amount: 1000,
      paidAmount: 1000,
      status: 'PAID'
    });

    await service.create('actor-1', {
      orderId: 'order-1',
      amount: 1000,
      status: 'PAID'
    } as any);

    expect(invoicesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1000,
        paidAmount: 1000,
        status: 'PAID'
      })
    );
  });

  it('rejects creating invoice when paidAmount is greater than amount', async () => {
    invoicesRepository.findOrderForPayer.mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      collaboratorId: null,
      totalPrice: 1000
    });

    await expect(
      service.create('actor-1', {
        orderId: 'order-1',
        amount: 1000,
        paidAmount: 1000.5
      } as any)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('auto-updates paidAmount on status-only updates', async () => {
    invoicesRepository.findById.mockResolvedValue({
      id: 'inv-2',
      orderId: 'order-1',
      amount: 800,
      discountAmount: 0,
      extraAmount: 0,
      paidAmount: 200,
      status: 'PARTIAL',
      payerType: 'CUSTOMER',
      payerId: 'customer-1'
    });
    invoicesRepository.update.mockResolvedValue({});

    await service.update('actor-1', 'inv-2', { status: 'UNPAID' } as any);
    expect(invoicesRepository.update).toHaveBeenCalledWith(
      'inv-2',
      expect.objectContaining({
        paidAmount: 0,
        status: 'UNPAID'
      })
    );

    await service.update('actor-1', 'inv-2', { status: 'PAID' } as any);
    expect(invoicesRepository.update).toHaveBeenLastCalledWith(
      'inv-2',
      expect.objectContaining({
        paidAmount: 800,
        status: 'PAID'
      })
    );
  });

  it('throws when invoice does not exist on update', async () => {
    invoicesRepository.findById.mockResolvedValue(null);
    await expect(service.update('actor-1', 'missing', { status: 'PAID' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes invoice status in list output when stored status is stale', async () => {
    invoicesRepository.list.mockResolvedValue([
      { id: 'inv-stale', amount: 200, paidAmount: 0, status: 'PAID' }
    ]);

    const rows = await service.list({} as any);
    expect(rows[0].status).toBe('UNPAID');
  });
});
