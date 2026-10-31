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

  async listSubscriptions(customerId: number, page = 1, pageSize = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where: { customerId },
        include: { plan: true, lines: { include: { product: { select: { name: true, type: true } } } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
      }),
      this.prisma.subscription.count({ where: { customerId } }),
    ]);
    return { items, total, page, page_size: pageSize };
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

  async listInvoices(customerId: number, status?: InvoiceStatus, page = 1, pageSize = 20) {
    const where: Prisma.InvoiceWhereInput = {
      customerId,
      ...(status ? { status } : { status: { not: InvoiceStatus.draft } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { lines: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      items: rows.map((inv) => ({ ...inv, overdue: isOverdue(inv) })),
      total,
      page,
      page_size: pageSize,
    };
  }

  async getInvoice(customerId: number, id: number) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, customerId, status: { not: InvoiceStatus.draft } },
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
