import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { ReportsService } from './reports.service';

class OverdueQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
}

@Controller('reports')
@Roles(Role.admin, Role.staff)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('summary')
  summary() {
    return this.reports.summary();
  }

  @Get('overdue')
  overdue(@Query() q: OverdueQuery) {
    return this.reports.overdue(q.page ?? 1, Math.min(q.page_size ?? 10, 100));
  }
}
