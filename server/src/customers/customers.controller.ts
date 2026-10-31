import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import type { RequestUser } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerListQueryDto, UpdateCustomerDto } from './customer.dto';

/** CUS-01: customers are staff-managed records; the portal serves customers their own data. */
@Controller('customers')
@Roles(Role.admin, Role.staff)
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  list(@Query() q: CustomerListQueryDto) {
    return this.customers.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.customers.get(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto, @Req() _req: Request & { user: RequestUser }) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }
}
