import { Controller, Get, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RolesService } from '../services/roles.service';

@Resource('roles')
@Controller('roles')
@UseGuards(AuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permission('roles.list')
  list() {
    return this.rolesService.list();
  }
}
