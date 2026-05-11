import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { MeshTypesService } from '../services/mesh-types.service';
import { CreateMeshTypeDto } from '../dto/create-mesh-type.dto';
import { UpdateMeshTypeDto } from '../dto/update-mesh-type.dto';

@Resource('mesh_types')
@Controller('mesh-types')
@UseGuards(AuthGuard, PermissionsGuard)
export class MeshTypesController {
  constructor(private readonly meshTypesService: MeshTypesService) {}

  @Get()
  @Permission('mesh_types.all')
  list(@Query('q') q?: string) {
    return this.meshTypesService.list(q);
  }

  @Post()
  @Permission('mesh_types.all')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateMeshTypeDto) {
    return this.meshTypesService.create(user.userId, dto);
  }

  @Patch(':id')
  @Permission('mesh_types.all')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateMeshTypeDto) {
    return this.meshTypesService.update(user.userId, id, dto);
  }
}
