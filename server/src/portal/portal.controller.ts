import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../common/roles.guard';
import { Role } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { PortalService } from './portal.service';
import { IsIn, IsOptional } from 'class-validator';

class PortalInvoiceQuery {
  @IsOptional()
  @IsIn(['draft', 'confirmed', 'paid', 'cancelled'])
  status?: 'draft' | 'confirmed' | 'paid' | 'cancelled';
}

/** Customer role only (§2.2). Scoping is server-side via users.customer_id (D8). */
@Controller('portal')
@Roles(Role.customer)
export class PortalController {
  constructor(private portal: PortalService) {}

  private customerId(req: Request & { user: RequestUser }): number {
    return req.user.customerId ?? -1;
  }

  @Get('summary')
  summary(@Req() req: Request & { user: RequestUser }) {
    return this.portal.summary(this.customerId(req));
  }

  @Get('subscriptions')
  subscriptions(@Req() req: Request & { user: RequestUser }) {
    return this.portal.listSubscriptions(this.customerId(req));
  }

  @Get('subscriptions/:id')
  subscription(@Req() req: Request & { user: RequestUser }, @Param('id', ParseIntPipe) id: number) {
    return this.portal.getSubscription(this.customerId(req), id);
  }

  @Get('invoices')
  invoices(@Req() req: Request & { user: RequestUser }, @Query() q: PortalInvoiceQuery) {
    return this.portal.listInvoices(this.customerId(req), q.status);
  }

  @Get('invoices/:id')
  invoice(@Req() req: Request & { user: RequestUser }, @Param('id', ParseIntPipe) id: number) {
    return this.portal.getInvoice(this.customerId(req), id);
  }
}
