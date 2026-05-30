import { Module } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './services/invoices.service';
import { InvoicesController } from './controllers/invoices.controller';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { CollaboratorsModule } from '../collaborators/collaborators.module';

@Module({
  imports: [OperationLogsModule, CollaboratorsModule],
  controllers: [InvoicesController],
  providers: [InvoicesRepository, InvoicesService],
  exports: [InvoicesService]
})
export class InvoicesModule {}
