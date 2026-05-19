-- 1) Soft-delete duplicated active invoices per order (keep latest)
WITH ranked AS (
  SELECT
    "id",
    "orderId",
    ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY "createdAt" DESC, "id" DESC) AS rn
  FROM "Invoice"
  WHERE "deletedAt" IS NULL AND "orderId" IS NOT NULL
)
UPDATE "Invoice" i
SET "deletedAt" = NOW()
FROM ranked r
WHERE i."id" = r."id" AND r.rn > 1;

-- 2) Remove VAT-related columns (extraAmount)
ALTER TABLE "Order" DROP COLUMN IF EXISTS "extraAmount";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "extraAmount";

-- 3) Create join table for many orders -> one invoice
CREATE TABLE "InvoiceOrder" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceOrder_orderId_key" ON "InvoiceOrder"("orderId");
CREATE UNIQUE INDEX "InvoiceOrder_invoiceId_orderId_key" ON "InvoiceOrder"("invoiceId", "orderId");
CREATE INDEX "InvoiceOrder_invoiceId_idx" ON "InvoiceOrder"("invoiceId");
CREATE INDEX "InvoiceOrder_orderId_idx" ON "InvoiceOrder"("orderId");

ALTER TABLE "InvoiceOrder"
ADD CONSTRAINT "InvoiceOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceOrder"
ADD CONSTRAINT "InvoiceOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Migrate old Invoice.orderId links into InvoiceOrder
INSERT INTO "InvoiceOrder" ("id", "invoiceId", "orderId", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  i."id",
  i."orderId",
  i."createdAt"
FROM "Invoice" i
JOIN "Order" o ON o."id" = i."orderId"
WHERE i."deletedAt" IS NULL
  AND o."deletedAt" IS NULL
  AND i."orderId" IS NOT NULL;

-- 5) Create payment history table
CREATE TABLE "InvoicePayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");
CREATE INDEX "InvoicePayment_paidAt_idx" ON "InvoicePayment"("paidAt");
CREATE INDEX "InvoicePayment_createdById_idx" ON "InvoicePayment"("createdById");

ALTER TABLE "InvoicePayment"
ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoicePayment"
ADD CONSTRAINT "InvoicePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) Seed one historical payment row from old paidAmount values
INSERT INTO "InvoicePayment" ("id", "invoiceId", "amount", "paidAt", "note", "createdById", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  i."id",
  i."paidAmount",
  COALESCE(i."paidAt", i."updatedAt", i."createdAt"),
  'مهاجرت خودکار از سابقه پرداخت قبلی',
  i."createdById",
  COALESCE(i."updatedAt", i."createdAt")
FROM "Invoice" i
WHERE i."deletedAt" IS NULL
  AND i."paidAmount" > 0;

-- 7) Drop old direct relation column
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_orderId_fkey";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "orderId";

-- 8) Normalize paidAmount/status after migration
UPDATE "Invoice" i
SET
  "paidAmount" = COALESCE(p.total_paid, 0),
  "status" = CASE
    WHEN COALESCE(p.total_paid, 0) <= 0 THEN 'UNPAID'::"InvoiceStatus"
    WHEN COALESCE(p.total_paid, 0) >= i."amount" THEN 'PAID'::"InvoiceStatus"
    ELSE 'PARTIAL'::"InvoiceStatus"
  END,
  "paidAt" = CASE
    WHEN COALESCE(p.total_paid, 0) >= i."amount" THEN COALESCE(p.last_paid_at, i."paidAt", i."updatedAt")
    ELSE NULL
  END
FROM (
  SELECT
    "invoiceId",
    SUM("amount") AS total_paid,
    MAX("paidAt") AS last_paid_at
  FROM "InvoicePayment"
  GROUP BY "invoiceId"
) p
WHERE p."invoiceId" = i."id";
