import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { isOverdue, startOfToday } from '../payments/payments.service';

/**
 * Customer portal (POR-01..05). Every query is scoped by req.user.customerId —
 * object-level authorization: a foreign ID in the URL is a 404, never data.
 */
@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) {}

  listSubscriptions(customerId: number) {
    return this.prisma.subscription.findMany({
      where: { customerId },
      include: { plan: true, lines: { include: { product: { select: { name: true, type: true } } } } },
      orderBy: { id: 'desc' },
    });
  }

  async getSubscription(customerId: number, id: number) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, customerId },
      include: {
        plan: true,
        lines: { include: { product: { select: { name: true, type: true } } } },
        history: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  listInvoices(customerId: number, status?: InvoiceStatus) {
    return this.prisma.invoice.findMany({
      where: { customerId, ...(status ? { status } : {}) },
      include: { lines: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    }).then((rows) => rows.map((inv) => ({ ...inv, overdue: isOverdue(inv) })));
  }

  async getInvoice(customerId: number, id: number) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, customerId },
      include: { lines: true, payments: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return { ...inv, overdue: isOverdue(inv) };
  }

  /** Portal-facing outstanding balance across the customer's invoices. */
  async summary(customerId: number) {
    const [activeSubs, outstanding, overdue] = await Promise.all([
      this.prisma.subscription.count({ where: { customerId, status: 'active' } }),
      this.prisma.invoice.aggregate({
        where: { customerId, status: { in: ['confirmed' as InvoiceStatus] } },
        _sum: { total: true, amountPaid: true },
      }),
      this.prisma.invoice.count({
        where: { customerId, status: InvoiceStatus.confirmed, dueDate: { lt: startOfToday() } },
      }),
    ]);
    const owed = new Prisma.Decimal(outstanding._sum.total ?? 0).minus(outstanding._sum.amountPaid ?? 0);
    return { active_subscriptions: activeSubs, outstanding: owed.toFixed(2), overdue_count: overdue };
  }
}
