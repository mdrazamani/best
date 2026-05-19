-- Remove deprecated order stage value and normalize existing rows
UPDATE "Order"
SET "stage" = 'IN_PROGRESS'
WHERE "stage" = 'STARTED';

ALTER TYPE "OrderStage" RENAME TO "OrderStage_old";

CREATE TYPE "OrderStage" AS ENUM (
  'RECEIVED',
  'IN_PROGRESS',
  'READY_IN_WAREHOUSE',
  'DELIVERED',
  'CANCELLED'
);

ALTER TABLE "Order"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE "OrderStage" USING ("stage"::text::"OrderStage"),
  ALTER COLUMN "stage" SET DEFAULT 'RECEIVED';

DROP TYPE "OrderStage_old";

-- Add optional per-line-item description
ALTER TABLE "OrderLineItem"
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Convert stored monetary values from rial to toman
UPDATE "Order"
SET
  "unitPrice" = CASE WHEN "unitPrice" IS NULL THEN NULL ELSE ROUND("unitPrice" / 10.0, 2) END,
  "totalPrice" = ROUND("totalPrice" / 10.0, 2),
  "discountAmount" = ROUND("discountAmount" / 10.0, 2),
  "extraAmount" = ROUND("extraAmount" / 10.0, 2);

UPDATE "OrderLineItem"
SET
  "unitPrice" = ROUND("unitPrice" / 10.0, 2),
  "lineTotal" = ROUND("lineTotal" / 10.0, 2);

UPDATE "Invoice"
SET
  "amount" = ROUND("amount" / 10.0, 2),
  "discountAmount" = ROUND("discountAmount" / 10.0, 2),
  "extraAmount" = ROUND("extraAmount" / 10.0, 2),
  "paidAmount" = ROUND("paidAmount" / 10.0, 2);
