import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { InvoiceListQueryDto, paginated } from '../payments/payment.dto';
import { isOverdue, startOfToday } from '../payments/payments.service';

const LIST_INCLUDE = { lines: true, payments: true, customer: { select: { id: true, name: true, company: true, email: true } } } satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async list(q: InvoiceListQueryDto) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? 20, 100);

    const where: Prisma.InvoiceWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.customer_id ? { customerId: q.customer_id } : {}),
      ...(q.subscription_id ? { subscriptionId: q.subscription_id } : {}),
      ...(q.overdue === 'true'
        ? { status: InvoiceStatus.confirmed, dueDate: { lt: startOfToday() } }
        : {}),
    };
    // overdue=true with an explicit other status is contradictory; the status
    // filter above wins when both are given (documented behavior).

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    // RPT-04: overdue list sorts by days overdue — computed client-side here
    // as a derived field on every row.
    const items = rows.map((inv) => ({ ...inv, overdue: isOverdue(inv) }));
    return paginated(items, total, page, pageSize);
  }

  async get(id: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: LIST_INCLUDE });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return { ...invoice, overdue: isOverdue(invoice) };
  }
}
