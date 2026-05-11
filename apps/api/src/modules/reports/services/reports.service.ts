import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { OrdersService } from '../../orders/services/orders.service';
import { InvoicesService } from '../../invoices/services/invoices.service';

@Injectable()
export class ReportsService extends BaseService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoicesService: InvoicesService
  ) {
    super();
  }

  async dashboard() {
    const [orders, invoices] = await Promise.all([
      this.ordersService.list({}),
      this.invoicesService.list({})
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalOrders = orders.length;
    const ordersToday = orders.filter((item: any) => new Date(item.createdAt) >= startOfDay).length;
    const processingOrders = orders.filter((item: any) => ['STARTED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE'].includes(item.stage)).length;
    const totalSales = orders.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0);
    const receivedAmount = invoices.reduce((sum: number, item: any) => sum + Number(item.paidAmount), 0);
    const remainingAmount = Math.max(totalSales - receivedAmount, 0);
    const unpaidInvoices = invoices.filter((item: any) => item.status !== 'PAID').length;

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
