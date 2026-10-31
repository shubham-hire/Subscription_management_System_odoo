import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { isOverdue, startOfToday } from '../payments/payments.service';

/** RPT-01/04 — all aggregates computed in the database (§9.1). */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const today = startOfToday();
    const [activeSubs, collected, outstanding, overdueAgg] = await this.prisma.$transaction([
      this.prisma.subscription.count({ where: { status: 'active' } }),
      // revenue collected = everything actually paid, across paid and partial invoices
      this.prisma.invoice.aggregate({ _sum: { amountPaid: true } }),
      // outstanding = confirmed invoices with remaining balance
      this.prisma.invoice.aggregate({
        where: { status: InvoiceStatus.confirmed },
        _sum: { total: true, amountPaid: true },
      }),
      // overdue = confirmed, balance > 0, due before today (D5)
      this.prisma.invoice.aggregate({
        where: { status: InvoiceStatus.confirmed, dueDate: { lt: today } },
        _sum: { total: true, amountPaid: true },
        _count: true,
      }),
    ]);

    const outstandingBalance = new Prisma.Decimal(outstanding._sum.total ?? 0).minus(outstanding._sum.amountPaid ?? 0);
    const overdueAmount = new Prisma.Decimal(overdueAgg._sum.total ?? 0).minus(overdueAgg._sum.amountPaid ?? 0);

    return {
      active_subscriptions: activeSubs,
      revenue_collected: collected._sum.amountPaid?.toFixed(2) ?? '0.00',
      outstanding: outstandingBalance.toFixed(2),
      overdue_count: overdueAgg._count,
      overdue_amount: overdueAmount.toFixed(2),
    };
  }

  /** RPT-04: overdue sorted by days overdue, with customer contact details. */
  async overdue() {
    const today = startOfToday();
    const invoices = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.confirmed, dueDate: { lt: today } },
      include: {
        customer: { select: { id: true, name: true, company: true, email: true, phone: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return invoices
      .filter((inv) => new Prisma.Decimal(inv.total).gt(inv.amountPaid))
      .map((inv) => ({
        id: inv.id,
        number: inv.number,
        customer: inv.customer,
        total: inv.total,
        amount_paid: inv.amountPaid,
        balance: new Prisma.Decimal(inv.total).minus(inv.amountPaid).toFixed(2),
        due_date: inv.dueDate,
        days_overdue: Math.floor((today.getTime() - inv.dueDate.getTime()) / 86_400_000),
        overdue: isOverdue(inv),
      }));
  }
}
