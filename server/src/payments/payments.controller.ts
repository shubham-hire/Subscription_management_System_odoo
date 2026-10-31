import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../common/prisma.service';

class PaymentListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
  @IsOptional() @Type(() => Number) @IsInt() invoice_id?: number;
}

/** GET /payments — payment history across all invoices (PAY-07). */
@Controller('payments')
@Roles(Role.admin, Role.staff)
export class PaymentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query() q: PaymentListQuery) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? 20, 100);
    const where: Prisma.PaymentWhereInput = {
      ...(q.invoice_id ? { invoiceId: q.invoice_id } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { id: true, number: true, customerId: true, customer: { select: { id: true, name: true, company: true } } } },
        },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, page_size: pageSize };
  }
}
