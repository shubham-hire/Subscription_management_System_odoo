import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { addPeriod } from '../domain/billing-dates';
import { validateTransition } from '../domain/transitions';
import { CreateSubscriptionDto, ListQueryDto, SubscriptionLineDto, UpdateLinesDto, paginated } from './subscription.dto';

const INCLUDE = {
  plan: true,
  customer: { select: { id: true, name: true, company: true, email: true } },
  lines: { include: { product: { select: { id: true, name: true, type: true } } } },
} satisfies Prisma.SubscriptionInclude;

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /** SUB-01..04, PLN-03/04, PRD-03, D3/D13/D14. */
  async create(dto: CreateSubscriptionDto, userId: number) {
    if (dto.lines.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one line is required',
        fields: { lines: 'At least one line is required' },
      });
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customer_id } });
    if (!customer) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Unknown customer', fields: { customer_id: 'Unknown customer' } });
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.plan_id } });
    if (!plan || !plan.isActive) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Unknown plan', fields: { plan_id: 'Unknown plan' } });
    }

    const start = new Date(dto.start_date);
    // PLN-03: selectable only inside the availability window
    if (start < plan.availableFrom || start > plan.availableTo) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Plan is available ${plan.availableFrom.toISOString().slice(0, 10)} to ${plan.availableTo.toISOString().slice(0, 10)}`,
        fields: { start_date: 'Outside the plan availability window' },
      });
    }

    // Resolve lines: effective unit price = sales price + variant extra (PRD-03)
    const resolved = await this.resolveLines(dto.lines, plan.minQuantity);

    const startDate = start;
    // D3: expiry = start + one billing period (editable later if needed)
    const expiryDate = addPeriod(startDate, plan.billingPeriod);
    if (expiryDate <= startDate) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Expiry must be after start', fields: { expiry: 'Expiry must be after start' } });
    }

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          customerId: dto.customer_id,
          planId: plan.id,
          status: 'draft',
          startDate,
          expiryDate,
          nextBillingDate: startDate,
          paymentTermsDays: dto.payment_terms_days ?? 0,
          createdBy: userId,
          lines: {
            create: resolved.map((r) => ({
              productId: r.productId,
              variantId: r.variantId ?? null,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              taxId: r.taxId ?? null,
            })),
          },
        },
        include: INCLUDE,
      });
      await tx.subscriptionStatusHistory.create({
        data: { subscriptionId: subscription.id, fromStatus: 'draft', toStatus: 'draft', changedBy: userId },
      });
      return subscription;
    });
  }

  /** Snapshot pricing per line: sales price + variant price extra (PRD-03, D14 min qty). */
  private async resolveLines(lines: SubscriptionLineDto[], minQuantity: number) {
    const productIds = [...new Set(lines.map((l) => l.product_id))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return Promise.all(
      lines.map(async (line) => {
        const product = byId.get(line.product_id);
        if (!product) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `Product ${line.product_id} not found or archived (PRD-05)`,
            fields: { lines: `Product ${line.product_id} not found or archived` },
          });
        }
        if (line.quantity < minQuantity) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `quantity must be at least the plan minimum of ${minQuantity}`,
            fields: { lines: `Plan minimum quantity is ${minQuantity}` },
          });
        }
        let variantExtra = new Prisma.Decimal(0);
        if (line.variant_id !== undefined) {
          const variant = product.variants.find((v) => v.id === line.variant_id);
          if (!variant || variant.productId !== product.id) {
            throw new BadRequestException({
              code: 'VALIDATION_ERROR',
              message: `Variant ${line.variant_id} does not belong to product ${product.id}`,
              fields: { lines: `Invalid variant for product ${product.id}` },
            });
          }
          variantExtra = variant.priceExtra;
        }
        return {
          productId: product.id,
          variantId: line.variant_id,
          quantity: line.quantity,
          unitPrice: new Prisma.Decimal(product.salesPrice).plus(variantExtra),
          taxId: line.tax_id ?? product.taxId ?? null,
        };
      }),
    );
  }

  async list(q: ListQueryDto) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? 20, 100);
    const where: Prisma.SubscriptionWhereInput = {
      ...(q.status ? { status: q.status as SubscriptionStatus } : {}),
      ...(q.customer_id ? { customerId: q.customer_id } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where, include: INCLUDE, orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return paginated(items, total, page, pageSize);
  }

  async get(id: number) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: { ...INCLUDE, history: { orderBy: { changedAt: 'asc' } }, invoices: { select: { id: true, number: true, status: true, total: true } } },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  /** SUB-05/10: validate via the domain state machine, write history, persist. */
  async transition(id: number, to: SubscriptionStatus, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id }, include: { plan: true } });
      if (!sub) throw new NotFoundException('Subscription not found');

      const error = validateTransition({
        from: sub.status,
        to,
        plan: {
          pausable: sub.plan.pausable,
          closable: sub.plan.closable,
          renewable: sub.plan.renewable,
          auto_close: sub.plan.autoClose,
        },
        // D10: quotation expiry — quotations created without a template get 30 days
        quotation_expires_at: sub.status === 'quotation' ? new Date(sub.startDate.getTime() + 30 * 86_400_000) : undefined,
      });
      if (error) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: error, fields: { transition: error } });
      }

      const from = sub.status;
      const updated = await tx.subscription.update({
        where: { id },
        data: {
          status: to,
          // close early stops future invoicing (SUB-10): clear next billing run selection
          ...(to === 'closed' ? { nextBillingDate: new Date('9999-12-31') } : {}),
        },
        include: INCLUDE,
      });
      await tx.subscriptionStatusHistory.create({
        data: { subscriptionId: id, fromStatus: from, toStatus: to, changedBy: userId },
      });
      return updated;
    });
  }

  /** D13: line edits only while Draft/Quotation. */
  async updateLines(id: number, dto: UpdateLinesDto, userId: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'draft' && sub.status !== 'quotation') {
      throw new ForbiddenException('Lines can only be edited while the subscription is Draft or Quotation');
    }
    const resolved = await this.resolveLines(dto.lines, sub.plan.minQuantity);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
      await tx.subscriptionLine.createMany({
        data: resolved.map((r) => ({
          subscriptionId: id,
          productId: r.productId,
          variantId: r.variantId ?? null,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          taxId: r.taxId ?? null,
        })),
      });
      await tx.subscriptionStatusHistory.create({
        data: { subscriptionId: id, fromStatus: sub.status, toStatus: sub.status, changedBy: userId },
      });
    });
    return this.get(id);
  }
}
