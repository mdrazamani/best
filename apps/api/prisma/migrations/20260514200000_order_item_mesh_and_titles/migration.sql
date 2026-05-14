ALTER TABLE "Order" ADD COLUMN "title" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "title" TEXT;

ALTER TABLE "OrderLineItem" ADD COLUMN "meshTypeId" TEXT;

UPDATE "OrderLineItem" AS "oli"
SET "meshTypeId" = "o"."meshTypeId"
FROM "Order" AS "o"
WHERE "oli"."orderId" = "o"."id";

ALTER TABLE "OrderLineItem" ALTER COLUMN "meshTypeId" SET NOT NULL;

CREATE INDEX "OrderLineItem_meshTypeId_idx" ON "OrderLineItem"("meshTypeId");

ALTER TABLE "OrderLineItem"
  ADD CONSTRAINT "OrderLineItem_meshTypeId_fkey"
  FOREIGN KEY ("meshTypeId") REFERENCES "MeshType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_meshTypeId_fkey";
DROP INDEX IF EXISTS "Order_meshTypeId_idx";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "meshTypeId";
