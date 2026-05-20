import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { Resource } from '../../../common/decorators/resource.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AdjustInventoryItemDto } from '../dto/adjust-inventory-item.dto';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { InventoryService } from '../services/inventory.service';

@Resource('inventory')
@Controller('inventory')
@UseGuards(AuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permission('inventory.all')
  list(@Query('q') q?: string) {
    return this.inventoryService.list(q);
  }

  @Post()
  @Permission('inventory.all')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(user.userId, dto);
  }

  @Patch(':id/adjust')
  @Permission('inventory.all')
  adjust(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: AdjustInventoryItemDto) {
    return this.inventoryService.adjust(user.userId, id, dto);
  }

  @Delete(':id')
  @Permission('inventory.all')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.inventoryService.remove(user.userId, id);
  }
}
