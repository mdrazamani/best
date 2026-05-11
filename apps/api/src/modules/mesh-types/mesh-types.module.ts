import { Module } from '@nestjs/common';
import { MeshTypesRepository } from './mesh-types.repository';
import { MeshTypesService } from './services/mesh-types.service';
import { MeshTypesController } from './controllers/mesh-types.controller';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';

@Module({
  imports: [OperationLogsModule],
  controllers: [MeshTypesController],
  providers: [MeshTypesRepository, MeshTypesService],
  exports: [MeshTypesService, MeshTypesRepository]
})
export class MeshTypesModule {}
