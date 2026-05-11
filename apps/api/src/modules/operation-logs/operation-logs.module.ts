import { Module } from '@nestjs/common';
import { OperationLogsRepository } from './operation-logs.repository';
import { OperationLogsService } from './services/operation-logs.service';
import { OperationLogsController } from './controllers/operation-logs.controller';

@Module({
  controllers: [OperationLogsController],
  providers: [OperationLogsRepository, OperationLogsService],
  exports: [OperationLogsService]
})
export class OperationLogsModule {}
