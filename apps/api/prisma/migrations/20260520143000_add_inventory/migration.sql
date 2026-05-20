CREATE TYPE "InventoryLogType" AS ENUM ('INCREASE', 'DECREASE');

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLog" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "InventoryLogType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "beforeQty" INTEGER NOT NULL,
  "afterQty" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "InventoryItem_deletedAt_idx" ON "InventoryItem"("deletedAt");
CREATE INDEX "InventoryLog_itemId_idx" ON "InventoryLog"("itemId");
CREATE INDEX "InventoryLog_actorId_idx" ON "InventoryLog"("actorId");
CREATE INDEX "InventoryLog_type_idx" ON "InventoryLog"("type");
CREATE INDEX "InventoryLog_createdAt_idx" ON "InventoryLog"("createdAt");

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
