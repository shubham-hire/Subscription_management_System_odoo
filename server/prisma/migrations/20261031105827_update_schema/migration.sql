-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "number" SET DEFAULT 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "number" SET DEFAULT 'SUB-' || lpad(nextval('subscription_number_seq')::text, 6, '0');
