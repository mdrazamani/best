-- CreateEnum
CREATE TYPE "InvoicePayerType" AS ENUM ('CUSTOMER', 'COLLABORATOR');

-- AlterTable
ALTER TABLE "Customer"
  ADD COLUMN "referredByCollaboratorId" TEXT;

ALTER TABLE "Order"
  ADD COLUMN "expectedCompletionDate" TIMESTAMP(3);

ALTER TABLE "Invoice"
  ADD COLUMN "payerType" "InvoicePayerType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "payerId" TEXT;

-- Indexes
CREATE INDEX "Customer_referredByCollaboratorId_idx" ON "Customer"("referredByCollaboratorId");
CREATE INDEX "Invoice_payerType_payerId_idx" ON "Invoice"("payerType", "payerId");

-- ForeignKey
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_referredByCollaboratorId_fkey"
  FOREIGN KEY ("referredByCollaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
