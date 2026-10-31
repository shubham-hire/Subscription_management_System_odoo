import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import type { RequestUser } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { InvoicesService } from './invoices.service';
import { InvoiceListQueryDto, PaymentDto } from '../payments/payment.dto';
import { PaymentsService } from '../payments/payments.service';

@Controller()
export class InvoicesController {
  constructor(
    private invoices: InvoicesService,
    private payments: PaymentsService,
  ) {}

  @Roles(Role.admin, Role.staff)
  @Get('invoices')
  list(@Query() q: InvoiceListQueryDto) {
    return this.invoices.list(q);
  }

  @Roles(Role.admin, Role.staff)
  @Get('invoices/:id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.invoices.get(id);
  }

  @Roles(Role.admin, Role.staff)
  @Post('invoices/:id/payments')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaymentDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.payments.recordPayment(id, dto, req.user.id);
  }
}
