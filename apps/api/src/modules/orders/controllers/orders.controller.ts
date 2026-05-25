import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { buildAttachmentContentDisposition } from '../../../common/utils/download.util';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { ListOrdersQueryDto } from '../dto/list-orders-query.dto';

@Resource('orders')
@Controller('orders')
@UseGuards(AuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Permission('orders.all')
  list(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(query);
  }

  @Get(':id')
  @Permission('orders.all')
  detail(@Param('id') id: string) {
    return this.ordersService.detail(id);
  }

  @Get(':id/line-items/:lineItemId/label')
  @Permission('orders.all')
  async lineItemLabel(@Param('id') id: string, @Param('lineItemId') lineItemId: string, @Res() reply: FastifyReply) {
    const file = await this.ordersService.lineItemLabelPdf(id, lineItemId);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', buildAttachmentContentDisposition(file.fileName))
      .header('Content-Length', String(file.buffer.length))
      .send(file.buffer);
  }

  @Get(':id/line-items/labels.zip')
  @Permission('orders.all')
  async allLineItemsLabels(@Param('id') id: string, @Res() reply: FastifyReply) {
    const file = await this.ordersService.allLineItemsLabelsZip(id);
    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', buildAttachmentContentDisposition(file.fileName))
      .header('Content-Length', String(file.buffer.length))
      .send(file.buffer);
  }

  @Post()
  @Permission('orders.all')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.userId, dto);
  }

  @Patch(':id')
  @Permission('orders.all')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @Permission('orders.all')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.ordersService.remove(user.userId, id);
  }
}
