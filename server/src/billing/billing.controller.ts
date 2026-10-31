import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import type { RequestUser } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private billing: BillingService) {}

  /** INV-09: manual "Run billing now" with a results summary. */
  @Roles(Role.admin, Role.staff)
  @Post('billing/run')
  run(@Req() req: Request & { user: RequestUser }) {
    return this.billing.run(req.user.id);
  }
}
