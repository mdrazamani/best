import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class ReportsService extends BaseService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async dashboard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalOrders, ordersToday, processingOrders, totalSalesAgg, receivedAmountAgg, unpaidInvoices] = await Promise.all([
      this.prisma.order.count({
        where: { deletedAt: null }
      }),
      this.prisma.order.count({
        where: {
          deletedAt: null,
          createdAt: { gte: startOfDay }
        }
      }),
      this.prisma.order.count({
        where: {
          deletedAt: null,
          stage: { in: ['STARTED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE'] }
        }
      }),
      this.prisma.order.aggregate({
        where: { deletedAt: null },
        _sum: { totalPrice: true }
      }),
      this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          order: { deletedAt: null }
        },
        _sum: { paidAmount: true }
      }),
      this.prisma.invoice.count({
        where: {
          deletedAt: null,
          order: { deletedAt: null },
          status: { not: 'PAID' }
        }
      })
    ]);

    const totalSales = Number(totalSalesAgg._sum.totalPrice ?? 0);
    const receivedAmount = Number(receivedAmountAgg._sum.paidAmount ?? 0);
    const remainingAmount = Math.max(totalSales - receivedAmount, 0);

    return {
      totalOrders,
      ordersToday,
      processingOrders,
      totalSales,
      receivedAmount,
      remainingAmount,
      unpaidInvoices
    };
  }
}
