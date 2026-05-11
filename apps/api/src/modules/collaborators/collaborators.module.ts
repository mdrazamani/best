import { Module } from '@nestjs/common';
import { CollaboratorsRepository } from './collaborators.repository';
import { CollaboratorsService } from './services/collaborators.service';
import { CollaboratorsController } from './controllers/collaborators.controller';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';

@Module({
  imports: [OperationLogsModule],
  controllers: [CollaboratorsController],
  providers: [CollaboratorsRepository, CollaboratorsService],
  exports: [CollaboratorsService]
})
export class CollaboratorsModule {}
