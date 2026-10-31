import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { PaymentDto } from './payment.dto';

/** D5: overdue = Confirmed, balance above 0, due date before today (§6.4). */
export function isOverdue(invoice: { status: InvoiceStatus; total: Prisma.Decimal | string; amountPaid: Prisma.Decimal | string; dueDate: Date }): boolean {
  return (
    invoice.status === InvoiceStatus.confirmed &&
    new Prisma.Decimal(invoice.total).gt(invoice.amountPaid) &&
    invoice.dueDate.getTime() < startOfToday().getTime()
  );
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  /** PAY-01/02/03/06 — validations and the Paid flip happen in one transaction. */
  async recordPayment(invoiceId: number, dto: PaymentDto, recordedBy: number) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      // regex validation already blocks negatives; zero reaches here
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Payment must be above zero',
        fields: { amount: 'Payment must be above zero' },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent payers on this invoice: two simultaneous
      // requests must see each other's amount, or both could pass the
      // balance check and overpay.
      await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');

      // PAY-06: no payments against Draft or Cancelled
      if (invoice.status === InvoiceStatus.draft || invoice.status === InvoiceStatus.cancelled) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Payments are not allowed on ${invoice.status} invoices`,
          fields: { invoice: `Payments are not allowed on ${invoice.status} invoices` },
        });
      }

      const outstanding = new Prisma.Decimal(invoice.total).minus(invoice.amountPaid);
      if (amount.gt(outstanding)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Amount exceeds outstanding balance',
          fields: { amount: `Exceeds outstanding balance of ${outstanding.toFixed(2)}` },
        });
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId,
          method: dto.method,
          amount,
          paymentDate: new Date(dto.date),
          note: dto.note,
          recordedBy,
        },
      });

      const amountPaid = new Prisma.Decimal(invoice.amountPaid).plus(amount);
      // PAY-03: Paid when total payments reach the invoice total
      const status = amountPaid.gte(invoice.total) ? InvoiceStatus.paid : invoice.status;
      await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status } });

      await tx.auditLog.create({
        data: { userId: recordedBy, action: 'payment.record', entity: 'invoice', entityId: invoiceId },
      });

      return payment;
    });
  }
}
