ALTER TABLE "Session"
  ADD COLUMN "previousRefreshTokenHash" TEXT,
  ADD COLUMN "previousRefreshValidUntil" TIMESTAMP(3);

CREATE INDEX "Session_previousRefreshValidUntil_idx" ON "Session"("previousRefreshValidUntil");
