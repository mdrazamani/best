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

    const [totalOrders, totalMeshesAgg, ordersToday, processingOrders, totalSalesAgg, receivedAmountAgg, unpaidInvoices] = await Promise.all([
      this.prisma.order.count({
        where: {
          deletedAt: null,
          stage: { not: 'CANCELLED' }
        }
      }),
      this.prisma.orderLineItem.aggregate({
        where: {
          order: {
            deletedAt: null,
            stage: { not: 'CANCELLED' }
          }
        },
        _sum: { quantity: true }
      }),
      this.prisma.order.count({
        where: {
          deletedAt: null,
          stage: { not: 'CANCELLED' },
          createdAt: { gte: startOfDay }
        }
      }),
      this.prisma.order.count({
        where: {
          deletedAt: null,
          stage: { in: ['IN_PROGRESS', 'READY_IN_WAREHOUSE'] }
        }
      }),
      this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          orders: {
            some: {
              order: {
                deletedAt: null,
                stage: { not: 'CANCELLED' }
              }
            }
          }
        },
        _sum: { amount: true }
      }),
      this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          orders: {
            some: {
              order: {
                deletedAt: null,
                stage: { not: 'CANCELLED' }
              }
            }
          }
        },
        _sum: { paidAmount: true }
      }),
      this.prisma.invoice.count({
        where: {
          deletedAt: null,
          orders: {
            some: {
              order: {
                deletedAt: null,
                stage: { not: 'CANCELLED' }
              }
            }
          },
          status: { not: 'PAID' }
        }
      })
    ]);

    const totalSales = Number(totalSalesAgg._sum.amount ?? 0);
    const totalMeshes = Number(totalMeshesAgg._sum.quantity ?? 0);
    const receivedAmount = Number(receivedAmountAgg._sum.paidAmount ?? 0);
    const remainingAmount = Math.max(totalSales - receivedAmount, 0);

    return {
      totalOrders,
      totalMeshes,
      ordersToday,
      processingOrders,
      totalSales,
      receivedAmount,
      remainingAmount,
      unpaidInvoices
    };
  }
}
