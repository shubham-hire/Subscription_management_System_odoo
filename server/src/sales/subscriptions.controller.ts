import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import type { RequestUser } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, ListQueryDto, UpdateLinesDto } from './subscription.dto';

@Controller()
export class SubscriptionsController {
  constructor(private subscriptions: SubscriptionsService) {}

  @Roles(Role.admin, Role.staff)
  @Post('subscriptions')
  create(@Body() dto: CreateSubscriptionDto, @Req() req: Request & { user: RequestUser }) {
    return this.subscriptions.create(dto, req.user.id);
  }

  @Roles(Role.admin, Role.staff)
  @Get('subscriptions')
  list(@Query() q: ListQueryDto) {
    return this.subscriptions.list(q);
  }

  @Roles(Role.admin, Role.staff)
  @Get('subscriptions/:id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptions.get(id);
  }

  @Roles(Role.admin, Role.staff)
  @Post('subscriptions/:id/quotation')
  quotation(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: RequestUser }) {
    return this.subscriptions.transition(id, 'quotation', req.user.id);
  }

  @Roles(Role.admin, Role.staff)
  @Post('subscriptions/:id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: RequestUser }) {
    return this.subscriptions.transition(id, 'confirmed', req.user.id);
  }

  @Roles(Role.admin, Role.staff)
  @Post('subscriptions/:id/activate')
  activate(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: RequestUser }) {
    return this.subscriptions.transition(id, 'active', req.user.id);
  }

  @Roles(Role.admin, Role.staff)
  @Post('subscriptions/:id/close')
  close(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: RequestUser }) {
    return this.subscriptions.transition(id, 'closed', req.user.id);
  }

  @Roles(Role.admin, Role.staff)
  @Patch('subscriptions/:id/lines')
  updateLines(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLinesDto, @Req() req: Request & { user: RequestUser }) {
    return this.subscriptions.updateLines(id, dto, req.user.id);
  }
}
