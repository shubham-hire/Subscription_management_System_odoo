import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(Role.admin, Role.staff)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('summary')
  summary() {
    return this.reports.summary();
  }

  @Get('overdue')
  overdue() {
    return this.reports.overdue();
  }
}
