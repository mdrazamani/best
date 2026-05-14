import { Module } from '@nestjs/common';
import { BackupsRepository } from './backups.repository';
import { BackupsService } from './services/backups.service';
import { BackupsController } from './controllers/backups.controller';

@Module({
  controllers: [BackupsController],
  providers: [BackupsRepository, BackupsService],
  exports: [BackupsService]
})
export class BackupsModule {}
