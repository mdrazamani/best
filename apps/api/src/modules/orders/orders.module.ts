import { Module } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './services/orders.service';
import { OrdersController } from './controllers/orders.controller';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [OperationLogsModule, InvoicesModule],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
