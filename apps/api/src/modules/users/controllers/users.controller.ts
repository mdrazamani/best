import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';

@Resource('users')
@Controller('users')
@UseGuards(AuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permission('users.list')
  list() {
    return this.usersService.list();
  }

  @Post()
  @Permission('users.create')
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(actor.userId, dto);
  }

  @Patch(':id')
  @Permission('users.create')
  update(@CurrentUser() actor: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(actor.userId, id, dto);
  }

  @Post(':id/roles')
  @Permission('users.create')
  assignRole(@CurrentUser() actor: CurrentUserPayload, @Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(actor.userId, id, dto.roleKey);
  }

  @Delete(':id')
  @Permission('users.create')
  remove(@CurrentUser() actor: CurrentUserPayload, @Param('id') id: string) {
    return this.usersService.remove(actor.userId, id);
  }
}
