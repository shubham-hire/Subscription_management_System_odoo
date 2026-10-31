import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateCustomerDto, CustomerListQueryDto, UpdateCustomerDto, paginated } from './customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /** CUS-01: staff/admin manage customer records; searchable, paginated. */
  async list(q: CustomerListQueryDto) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? 20, 100);
    const where: Prisma.CustomerWhereInput = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { company: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.customer.count({ where }),
    ]);
    return paginated(items, total, page, pageSize);
  }

  /** CUS-03: detail page aggregates the customer's subscriptions, invoices and outstanding. */
  async get(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        subscriptions: {
          select: { id: true, number: true, status: true, startDate: true, expiryDate: true },
          orderBy: { id: 'desc' },
        },
        invoices: {
          select: { id: true, number: true, status: true, total: true, amountPaid: true },
          orderBy: { id: 'desc' },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const outstanding = customer.invoices.reduce(
      (acc, inv) =>
        inv.status === 'confirmed'
          ? acc.plus(new Prisma.Decimal(inv.total).minus(inv.amountPaid))
          : acc,
      new Prisma.Decimal(0),
    );
    const { invoices, subscriptions, ...rest } = customer;
    return { ...rest, subscriptions, invoices, outstanding: outstanding.toFixed(2) };
  }

  async create(dto: CreateCustomerDto) {
    await this.assertEmailFree(dto.email);
    return this.prisma.customer.create({
      data: {
        name: dto.name,
        email: dto.email,
        company: dto.company,
        phone: dto.phone,
        billingAddress: dto.billing_address,
        taxId: dto.tax_id,
      },
    });
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Customer not found');
    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailFree(dto.email);
    }
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.billing_address !== undefined ? { billingAddress: dto.billing_address } : {}),
        ...(dto.tax_id !== undefined ? { taxId: dto.tax_id } : {}),
      },
    });
  }

  private async assertEmailFree(email: string) {
    const existing = await this.prisma.customer.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Email is already in use',
        fields: { email: 'Already in use' },
      });
    }
  }
}
