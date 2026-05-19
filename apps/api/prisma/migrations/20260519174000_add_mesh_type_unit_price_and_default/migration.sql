ALTER TABLE "MeshType"
ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "MeshType_isDefault_idx" ON "MeshType"("isDefault");

WITH first_active AS (
  SELECT "id"
  FROM "MeshType"
  WHERE "deletedAt" IS NULL
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "MeshType" m
SET "isDefault" = true
FROM first_active fa
WHERE m."id" = fa."id"
  AND NOT EXISTS (
    SELECT 1 FROM "MeshType"
    WHERE "deletedAt" IS NULL
      AND "isDefault" = true
  );

