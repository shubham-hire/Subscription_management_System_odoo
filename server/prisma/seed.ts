/**
 * Seed v1 (Step 2) — logins + demo catalog. Scale seed (subscriptions +
 * invoices) is added in Step 7. Idempotent: upserts by unique keys.
 */
import { PrismaClient, DiscountScope, DiscountType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Passw0rd!';
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Users (D8: customer user links to a customer record) ──
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brightloop.test' },
    update: {},
    create: { name: 'Asha Admin', email: 'admin@brightloop.test', passwordHash: hash, role: 'admin' },
  });
  const staff = await prisma.user.upsert({
    where: { email: 'staff@brightloop.test' },
    update: {},
    create: { name: 'Sam Staff', email: 'staff@brightloop.test', passwordHash: hash, role: 'staff' },
  });

  const shopCustomer = await prisma.customer.upsert({
    where: { email: 'customer@brightloop.test' },
    update: {},
    create: {
      name: 'Priya Patel',
      company: 'Patel General Store',
      email: 'customer@brightloop.test',
      phone: '+91 98765 43210',
      billingAddress: '12 Market Road, Pune, MH 411001',
      taxId: '27ABCDE1234F1Z5',
    },
  });
  await prisma.user.upsert({
    where: { email: 'customer@brightloop.test' },
    update: {},
    create: {
      name: 'Priya Patel',
      email: 'customer@brightloop.test',
      passwordHash: hash,
      role: 'customer',
      customerId: shopCustomer.id,
    },
  });

  // ── Tax ──
  const gst = await prisma.tax.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'GST 18%', percentage: 18 },
  });

  // ── Product + Odoo variant (demo acceptance #4: +560) ──
  const product = await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'ERP Software',
      type: 'software',
      salesPrice: 2999,
      costPrice: 1500,
      notes: 'Core business software, billed per seat',
      taxId: gst.id,
    },
  });
  const odooVariant = await prisma.productVariant.upsert({
    where: { id: 1 },
    update: {},
    create: { productId: product.id, attribute: 'Brand', value: 'Odoo', priceExtra: 560 },
  });

  // ── Plan (demo scene 5: pausable = false shows no Pause button) ──
  await prisma.plan.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Business Monthly',
      price: 2999, // informational (D2)
      billingPeriod: 'monthly',
      minQuantity: 1,
      availableFrom: daysFromNow(-30),
      availableTo: daysFromNow(365),
      autoClose: true,
      closable: true,
      pausable: false,
      renewable: true,
    },
  });

  // ── Discount rule (auto-applies at billing, D1; demo scene: 10% for 2+ seats) ──
  await prisma.discount.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Bulk seats 10%',
      type: DiscountType.percentage,
      value: 10,
      minQuantity: 2,
      startDate: daysFromNow(-7),
      endDate: daysFromNow(60),
      maxUses: 100,
      scope: DiscountScope.product,
    },
  });
  await prisma.discountProduct.upsert({
    where: { discountId_productId: { discountId: 1, productId: product.id } },
    update: {},
    create: { discountId: 1, productId: product.id },
  });

  console.log('Seed v1 complete:');
  console.log(`  users: ${admin.email}, ${staff.email}, ${shopCustomer.email} — password "${PASSWORD}"`);
  console.log(`  catalog: ${product.name} (+ Odoo variant ₹${odooVariant.priceExtra}), GST 18%, Business Monthly plan, "Bulk seats 10%"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
