import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { InvoicesService } from '../services/invoices.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { ListInvoicesQueryDto } from '../dto/list-invoices-query.dto';
import { AddInvoicePaymentDto } from '../dto/add-invoice-payment.dto';

@Resource('invoices')
@Controller('invoices')
@UseGuards(AuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Permission('invoices.all')
  list(@Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.list(query);
  }

  @Post()
  @Permission('invoices.all')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.userId, dto);
  }

  @Get(':id')
  @Permission('invoices.all')
  detail(@Param('id') id: string) {
    return this.invoicesService.detail(id);
  }

  @Patch(':id')
  @Permission('invoices.all')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(user.userId, id, dto);
  }

  @Post(':id/payments')
  @Permission('invoices.all')
  addPayment(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: AddInvoicePaymentDto) {
    return this.invoicesService.addPayment(user.userId, id, dto);
  }

  @Delete(':id')
  @Permission('invoices.all')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.invoicesService.remove(user.userId, id);
  }

  @Get(':id/pdf')
  @Permission('invoices.all')
  async pdf(@Param('id') id: string, @Res() reply: FastifyReply) {
    const file = await this.invoicesService.pdf(id);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename=${file.fileName}`)
      .send(file.buffer);
  }
}
