import { Module } from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './services/customers.service';
import { CustomersController } from './controllers/customers.controller';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';

@Module({
  imports: [OperationLogsModule],
  controllers: [CustomersController],
  providers: [CustomersRepository, CustomersService],
  exports: [CustomersService]
})
export class CustomersModule {}
