import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Resource } from '../../../common/decorators/resource.decorator';
import { Permission } from '../../../common/decorators/permission.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CollaboratorsService } from '../services/collaborators.service';
import { CreateCollaboratorDto } from '../dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from '../dto/update-collaborator.dto';
import { AddCollaboratorPaymentDto } from '../dto/add-collaborator-payment.dto';

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

  @Post(':id/payments')
  @Permission('collaborators.all')
  addPayment(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: AddCollaboratorPaymentDto) {
    return this.collaboratorsService.addPayment(user.userId, id, dto);
  }

  @Get(':id/payments/:paymentId/pdf')
  @Permission('collaborators.all')
  async paymentReceiptPdf(@Param('id') id: string, @Param('paymentId') paymentId: string, @Res() reply: FastifyReply) {
    const file = await this.collaboratorsService.paymentReceiptPdf(id, paymentId);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', file.contentDisposition)
      .header('Content-Length', String(file.buffer.length))
      .send(file.buffer);
  }

  @Delete(':id')
  @Permission('collaborators.all')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.collaboratorsService.remove(user.userId, id);
  }
}


