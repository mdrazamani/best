import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { buildAttachmentContentDisposition } from '../../../common/utils/download.util';
import { BackupsService } from '../services/backups.service';
import { UpdateBackupSettingsDto } from '../dto/update-backup-settings.dto';

@Resource('backups')
@Controller('backups')
@UseGuards(AuthGuard, PermissionsGuard)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get('logs')
  @Permission('backups.all')
  logs() {
    return this.backupsService.listLogs();
  }

  @Get('settings')
  @Permission('backups.all')
  settings() {
    return this.backupsService.getSettings();
  }

  @Put('settings')
  @Permission('backups.all')
  updateSettings(@Body() dto: UpdateBackupSettingsDto) {
    return this.backupsService.updateSettings(dto.backupIntervalMinutes);
  }

  @Post('run')
  @Permission('backups.all')
  run() {
    return this.backupsService.runBackup();
  }

  @Get(':id/sql')
  @Permission('backups.all')
  async sql(@Param('id') id: string, @Res() reply: FastifyReply) {
    const file = await this.backupsService.readSql(id);
    reply
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', buildAttachmentContentDisposition(file.fileName))
      .header('Content-Length', String(file.buffer.length))
      .send(file.buffer);
  }

  @Get(':id/archive')
  @Permission('backups.all')
  async archive(@Param('id') id: string, @Res() reply: FastifyReply) {
    const file = await this.backupsService.readArchive(id);
    reply
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', buildAttachmentContentDisposition(file.fileName))
      .header('Content-Length', String(file.buffer.length))
      .send(file.buffer);
  }

  @Get(':id/excel')
  @Permission('backups.all')
  async excel(@Param('id') id: string, @Query('file') file: string, @Res() reply: FastifyReply) {
    const item = await this.backupsService.readExcel(id, file);
    reply
      .header('Content-Type', item.contentType)
      .header('Content-Disposition', buildAttachmentContentDisposition(item.fileName))
      .header('Content-Length', String(item.buffer.length))
      .send(item.buffer);
  }
}
