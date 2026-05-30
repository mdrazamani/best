CREATE TABLE "CollaboratorPayment" (
  "id" TEXT NOT NULL,
  "collaboratorId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollaboratorPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollaboratorPayment_collaboratorId_idx" ON "CollaboratorPayment"("collaboratorId");
CREATE INDEX "CollaboratorPayment_paidAt_idx" ON "CollaboratorPayment"("paidAt");
CREATE INDEX "CollaboratorPayment_createdById_idx" ON "CollaboratorPayment"("createdById");

ALTER TABLE "CollaboratorPayment"
ADD CONSTRAINT "CollaboratorPayment_collaboratorId_fkey"
FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollaboratorPayment"
ADD CONSTRAINT "CollaboratorPayment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
