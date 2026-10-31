import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { InvoiceListQueryDto, paginated } from '../payments/payment.dto';
import { isOverdue, startOfToday } from '../payments/payments.service';

const LIST_INCLUDE = {
  lines: true,
  payments: true,
  customer: { select: { id: true, name: true, company: true, email: true } },
  subscription: { select: { id: true, number: true } },
} satisfies Prisma.InvoiceInclude;

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

  /** §5.2: Draft/Confirmed → Cancelled — never once a payment has been recorded. */
  async cancel(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { _count: { select: { payments: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === 'paid') {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Paid invoices cannot be cancelled — issue a credit note instead',
          fields: { status: 'Invoice is already paid' },
        });
      }
      if (invoice._count.payments > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invoices with recorded payments cannot be cancelled',
          fields: { status: 'A payment has already been recorded' },
        });
      }
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'cancelled' },
        include: LIST_INCLUDE,
      });
      await tx.auditLog.create({
        data: { userId, action: 'invoice.cancel', entity: 'invoice', entityId: id },
      });
      return { ...updated, overdue: false };
    });
  }
}
