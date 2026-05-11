import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CustomersService } from '../services/customers.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Resource('customers')
@Controller('customers')
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permission('customers.all')
  list(@Query('q') q?: string) {
    return this.customersService.list(q);
  }

  @Get(':id')
  @Permission('customers.all')
  detail(@Param('id') id: string) {
    return this.customersService.detail(id);
  }

  @Post()
  @Permission('customers.all')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.userId, dto);
  }

  @Patch(':id')
  @Permission('customers.all')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @Permission('customers.all')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.customersService.remove(user.userId, id);
  }
}
