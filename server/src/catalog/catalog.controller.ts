import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { CatalogService } from './catalog.service';
import { DiscountDto, ListQueryDto, PlanDto, ProductDto, TaxDto, VariantCreateDto } from './catalog.dto';

/**
 * Catalog: Admin writes (§2.2), Staff reads. Every route requires a valid
 * token (JwtAuthGuard) — staff can GET but not POST/PATCH/DELETE.
 */
@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  // ── Products ──
  @Roles(Role.admin, Role.staff)
  @Get('products')
  listProducts(@Query() q: ListQueryDto) {
    return this.catalog.listProducts(q);
  }

  @Roles(Role.admin, Role.staff)
  @Get('products/:id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.getProduct(id);
  }

  @Roles(Role.admin)
  @Post('products')
  createProduct(@Body() dto: ProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Roles(Role.admin)
  @Patch('products/:id')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<ProductDto>) {
    return this.catalog.updateProduct(id, dto);
  }

  /** Archive (PRD-05) — DELETE is soft. */
  @Roles(Role.admin)
  @Delete('products/:id')
  archiveProduct(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.archiveProduct(id);
  }

  @Roles(Role.admin)
  @Post('products/:id/variants')
  addVariant(@Param('id', ParseIntPipe) id: number, @Body() dto: VariantCreateDto) {
    return this.catalog.addVariant(id, dto);
  }

  // ── Plans ──
  @Roles(Role.admin, Role.staff)
  @Get('plans')
  listPlans(@Query() q: ListQueryDto) {
    return this.catalog.listPlans(q);
  }

  @Roles(Role.admin, Role.staff)
  @Get('plans/:id')
  getPlan(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.getPlan(id);
  }

  @Roles(Role.admin)
  @Post('plans')
  createPlan(@Body() dto: PlanDto) {
    return this.catalog.createPlan(dto);
  }

  @Roles(Role.admin)
  @Patch('plans/:id')
  updatePlan(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<PlanDto>) {
    return this.catalog.updatePlan(id, dto);
  }

  // ── Taxes ──
  @Roles(Role.admin, Role.staff)
  @Get('taxes')
  listTaxes() {
    return this.catalog.listTaxes();
  }

  @Roles(Role.admin)
  @Post('taxes')
  createTax(@Body() dto: TaxDto) {
    return this.catalog.createTax(dto);
  }

  @Roles(Role.admin)
  @Patch('taxes/:id')
  updateTax(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<TaxDto>) {
    return this.catalog.updateTax(id, dto);
  }

  // ── Discounts ──
  @Roles(Role.admin)
  @Get('discounts')
  listDiscounts() {
    return this.catalog.listDiscounts();
  }

  @Roles(Role.admin)
  @Post('discounts')
  createDiscount(@Body() dto: DiscountDto) {
    return this.catalog.createDiscount(dto);
  }

  @Roles(Role.admin)
  @Patch('discounts/:id')
  updateDiscount(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<DiscountDto>) {
    return this.catalog.updateDiscount(id, dto);
  }
}
