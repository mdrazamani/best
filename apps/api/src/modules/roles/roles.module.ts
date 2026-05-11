import { Module } from '@nestjs/common';
import { RolesService } from './services/roles.service';
import { RolesRepository } from './roles.repository';
import { RolesController } from './controllers/roles.controller';

@Module({
  controllers: [RolesController],
  providers: [RolesService, RolesRepository],
  exports: [RolesService]
})
export class RolesModule {}
