import { Global, Module } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './services/permissions.service';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesModule } from '../roles/roles.module';

@Global()
@Module({
  imports: [RolesModule],
  controllers: [PermissionsController],
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsService]
})
export class PermissionsModule {}
