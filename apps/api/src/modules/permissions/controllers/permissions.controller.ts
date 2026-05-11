import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PermissionsService } from '../services/permissions.service';
import { SetRolePermissionsDto } from '../dto/set-role-permissions.dto';

@Resource('permissions')
@Controller('permissions')
@UseGuards(AuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Permission('permissions.list')
  list() {
    return this.permissionsService.list();
  }

  @Put('roles/:roleKey')
  @Permission('roles.manage')
  setRolePermissions(@Param('roleKey') roleKey: string, @Body() dto: SetRolePermissionsDto) {
    return this.permissionsService.setRolePermissions(roleKey, dto.permissionKeys);
  }
}
