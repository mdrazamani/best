import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CollaboratorsService } from '../services/collaborators.service';
import { CreateCollaboratorDto } from '../dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from '../dto/update-collaborator.dto';

@Resource('collaborators')
@Controller('collaborators')
@UseGuards(AuthGuard, PermissionsGuard)
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Get()
  @Permission('collaborators.all')
  list(@Query('q') q?: string) {
    return this.collaboratorsService.list(q);
  }

  @Get(':id')
  @Permission('collaborators.all')
  detail(@Param('id') id: string) {
    return this.collaboratorsService.detail(id);
  }

  @Post()
  @Permission('collaborators.all')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCollaboratorDto) {
    return this.collaboratorsService.create(user.userId, dto);
  }

  @Patch(':id')
  @Permission('collaborators.all')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateCollaboratorDto) {
    return this.collaboratorsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @Permission('collaborators.all')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.collaboratorsService.remove(user.userId, id);
  }
}
