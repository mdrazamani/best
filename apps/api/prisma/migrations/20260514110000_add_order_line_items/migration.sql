CREATE TABLE "OrderLineItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "width" DECIMAL(18,2) NOT NULL,
  "height" DECIMAL(18,2) NOT NULL,
  "quantity" DECIMAL(18,2) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

ALTER TABLE "OrderLineItem"
  ADD CONSTRAINT "OrderLineItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
