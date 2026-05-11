import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { RolesModule } from '../roles/roles.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';

@Module({
  imports: [RolesModule, OperationLogsModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService]
})
export class UsersModule {}
