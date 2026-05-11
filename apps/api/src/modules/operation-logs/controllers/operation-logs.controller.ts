import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { OperationLogsService } from '../services/operation-logs.service';

@Resource('operation_logs')
@Controller('operation-logs')
@UseGuards(AuthGuard, PermissionsGuard)
export class OperationLogsController {
  constructor(private readonly operationLogsService: OperationLogsService) {}

  @Get()
  @Permission('logs.list')
  list(@Query('limit') limit?: string) {
    return this.operationLogsService.list(Number(limit ?? '100'));
  }
}
