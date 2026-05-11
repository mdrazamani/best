import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { SessionsService } from '../services/sessions.service';

@Resource('sessions')
@Controller('sessions')
@UseGuards(AuthGuard, PermissionsGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @Permission('users.list')
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.sessionsService.listForUser(user.userId, user.sessionId);
  }

  @Delete(':id')
  @Permission('users.list')
  revoke(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.sessionsService.revoke(user.userId, id);
  }
}
