import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DiscountDto, ListQueryDto, paginated, PlanDto, ProductDto, TaxDto, VariantCreateDto } from './catalog.dto';

const PAGE_DEFAULT = 20;

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  private paging(q: ListQueryDto) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? PAGE_DEFAULT, 100);
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
  }

  // ── Products (PRD-01..06) ──────────────────────────────────────────────────

  async listProducts(q: ListQueryDto) {
    const { page, pageSize, skip, take } = this.paging(q);
    const where: Prisma.ProductWhereInput = {
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { variants: true, tax: true },
        skip,
        take,
        orderBy: { id: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(items, total, page, pageSize);
  }

  getProduct(id: number) {
    return this.findProductOrThrow(id);
  }

  /** PRD-04: cost > sales price is a warning in the response, not an error. */
  async createProduct(dto: ProductDto) {
    await this.assertTaxExists(dto.tax_id);
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        type: dto.type,
        salesPrice: new Prisma.Decimal(dto.sales_price),
        costPrice: new Prisma.Decimal(dto.cost_price),
        notes: dto.notes,
        taxId: dto.tax_id,
        variants: dto.variants
          ? { create: dto.variants.map((v) => ({ attribute: v.attribute, value: v.value, priceExtra: new Prisma.Decimal(v.price_extra) })) }
          : undefined,
      },
      include: { variants: true, tax: true },
    });
    return { product, warning: this.costWarning(dto.cost_price, dto.sales_price) };
  }

  async updateProduct(id: number, dto: Partial<ProductDto>) {
    await this.findProductOrThrow(id);
    if (dto.tax_id) await this.assertTaxExists(dto.tax_id);
    const data: Prisma.ProductUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.sales_price !== undefined ? { salesPrice: new Prisma.Decimal(dto.sales_price) } : {}),
      ...(dto.cost_price !== undefined ? { costPrice: new Prisma.Decimal(dto.cost_price) } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.tax_id !== undefined ? { tax: dto.tax_id ? { connect: { id: dto.tax_id } } : { disconnect: true } } : {}),
    };
    const product = await this.prisma.product.update({ where: { id }, data, include: { variants: true, tax: true } });
    return { product, warning: this.costWarning(dto.cost_price ?? product.costPrice.toString(), dto.sales_price ?? product.salesPrice.toString()) };
  }

  /** Archive, not delete (PRD-05: archived products stay on historic records). */
  async archiveProduct(id: number) {
    await this.findProductOrThrow(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false }, include: { variants: true, tax: true } });
  }

  async addVariant(id: number, dto: VariantCreateDto) {
    await this.findProductOrThrow(id);
    return this.prisma.productVariant.create({
      data: {
        productId: id,
        attribute: dto.variant.attribute,
        value: dto.variant.value,
        priceExtra: new Prisma.Decimal(dto.variant.price_extra),
      },
    });
  }

  private costWarning(cost: string, sales: string) {
    return Number(cost) > Number(sales) ? 'Cost price is above sales price' : undefined;
  }

  private async assertTaxExists(taxId?: number) {
    if (taxId === undefined) return;
    const tax = await this.prisma.tax.findUnique({ where: { id: taxId } });
    if (!tax) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Unknown tax', fields: { tax_id: 'Unknown tax' } });
  }

  private async findProductOrThrow(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { variants: true, tax: true } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ── Plans (PLN-01..06) ─────────────────────────────────────────────────────

  async listPlans(q: ListQueryDto) {
    const { page, pageSize, skip, take } = this.paging(q);
    const where: Prisma.PlanWhereInput = {
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      this.prisma.plan.count({ where }),
    ]);
    return paginated(items, total, page, pageSize);
  }

  async getPlan(id: number) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async createPlan(dto: PlanDto) {
    this.assertDateOrder(dto.available_from, dto.available_to, 'available_to must be after available_from'); // PLN-06
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        billingPeriod: dto.billing_period,
        minQuantity: dto.min_quantity,
        availableFrom: dto.available_from,
        availableTo: dto.available_to,
        autoClose: dto.auto_close ?? false,
        closable: dto.closable ?? true,
        pausable: dto.pausable ?? false,
        renewable: dto.renewable ?? true,
      },
    });
  }

  async updatePlan(id: number, dto: Partial<PlanDto>) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    const from = dto.available_from ?? plan.availableFrom;
    const to = dto.available_to ?? plan.availableTo;
    this.assertDateOrder(from, to, 'available_to must be after available_from');
    const data: Prisma.PlanUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
      ...(dto.billing_period !== undefined ? { billingPeriod: dto.billing_period } : {}),
      ...(dto.min_quantity !== undefined ? { minQuantity: dto.min_quantity } : {}),
      ...(dto.available_from !== undefined ? { availableFrom: dto.available_from } : {}),
      ...(dto.available_to !== undefined ? { availableTo: dto.available_to } : {}),
      ...(dto.auto_close !== undefined ? { autoClose: dto.auto_close } : {}),
      ...(dto.closable !== undefined ? { closable: dto.closable } : {}),
      ...(dto.pausable !== undefined ? { pausable: dto.pausable } : {}),
      ...(dto.renewable !== undefined ? { renewable: dto.renewable } : {}),
    };
    return this.prisma.plan.update({ where: { id }, data });
  }

  // ── Taxes (TAX-01..04) ─────────────────────────────────────────────────────

  async listTaxes() {
    return this.prisma.tax.findMany({ orderBy: { id: 'asc' } });
  }

  async createTax(dto: TaxDto) {
    this.assertPercentage(dto.percentage); // TAX-04
    return this.prisma.tax.create({ data: { name: dto.name, percentage: dto.percentage, isActive: dto.is_active ?? true } });
  }

  async updateTax(id: number, dto: Partial<TaxDto>) {
    const tax = await this.prisma.tax.findUnique({ where: { id } });
    if (!tax) throw new NotFoundException('Tax not found');
    if (dto.percentage !== undefined) this.assertPercentage(dto.percentage);
    return this.prisma.tax.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.percentage !== undefined ? { percentage: dto.percentage } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
    });
  }

  // ── Discounts (DSC-01..08, auto-applied at billing — D1) ──────────────────

  async listDiscounts() {
    return this.prisma.discount.findMany({ include: { products: true }, orderBy: { id: 'asc' } });
  }

  async createDiscount(dto: DiscountDto) {
    this.assertDiscountValue(dto.type, dto.value); // DSC-06
    this.assertDateOrder(dto.start_date, dto.end_date, 'end_date must be after start_date');
    await this.assertDiscountProducts(dto);
    return this.prisma.discount.create({
      data: {
        name: dto.name,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minPurchase: new Prisma.Decimal(dto.min_purchase ?? '0'),
        minQuantity: dto.min_quantity ?? 0,
        startDate: dto.start_date,
        endDate: dto.end_date,
        maxUses: dto.max_uses ?? 0, // 0 = unlimited
        scope: dto.scope,
        products:
          dto.scope === 'product'
            ? { create: (dto.product_ids ?? []).map((productId) => ({ productId })) }
            : undefined,
      },
      include: { products: true },
    });
  }

  async updateDiscount(id: number, dto: Partial<DiscountDto>) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    const type = dto.type ?? discount.type;
    const value = dto.value ?? discount.value.toString();
    this.assertDiscountValue(type, value);
    const start = dto.start_date ?? discount.startDate;
    const end = dto.end_date ?? discount.endDate;
    this.assertDateOrder(start, end, 'end_date must be after start_date');
    return this.prisma.discount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: new Prisma.Decimal(dto.value) } : {}),
        ...(dto.min_purchase !== undefined ? { minPurchase: new Prisma.Decimal(dto.min_purchase) } : {}),
        ...(dto.min_quantity !== undefined ? { minQuantity: dto.min_quantity } : {}),
        ...(dto.start_date !== undefined ? { startDate: dto.start_date } : {}),
        ...(dto.end_date !== undefined ? { endDate: dto.end_date } : {}),
        ...(dto.max_uses !== undefined ? { maxUses: dto.max_uses } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
      include: { products: true },
    });
  }

  private assertPercentage(pct: number) {
    if (pct < 0 || pct > 100) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'percentage must be between 0 and 100',
        fields: { percentage: 'percentage must be between 0 and 100' },
      });
    }
  }

  private assertDiscountValue(type: 'fixed' | 'percentage', value: string) {
    const n = Number(value);
    if (type === 'percentage' && (n < 1 || n > 100)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Percentage discount must be between 1 and 100', fields: { value: 'Percentage discount must be between 1 and 100' } });
    }
    if (type === 'fixed' && n <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Fixed discount must be above zero', fields: { value: 'Fixed discount must be above zero' } });
    }
  }

  private assertDateOrder(start: Date, end: Date, message: string) {
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message, fields: { end_date: message } });
    }
  }

  private async assertDiscountProducts(dto: DiscountDto) {
    if (dto.scope !== 'product') return;
    if (!dto.product_ids?.length) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'product_ids required for product-scope discounts', fields: { product_ids: 'Required for product scope' } });
    }
    const found = await this.prisma.product.count({ where: { id: { in: dto.product_ids } } });
    if (found !== dto.product_ids.length) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Unknown product in product_ids', fields: { product_ids: 'Unknown product' } });
    }
  }
}
