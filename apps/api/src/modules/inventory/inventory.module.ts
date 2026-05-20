import { Module } from '@nestjs/common';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { InventoryController } from './controllers/inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './services/inventory.service';

@Module({
  imports: [OperationLogsModule],
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService]
})
export class InventoryModule {}
