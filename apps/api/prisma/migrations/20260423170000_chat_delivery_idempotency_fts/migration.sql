DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatMessageDeliveryStatus') THEN
    CREATE TYPE "ChatMessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED');
  END IF;
END
$$;

ALTER TABLE "ChatMessage"
  ADD COLUMN IF NOT EXISTS "clientMessageId" varchar(120),
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "ChatMessageDeliveryStatus" NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS "deliveryErrorCode" varchar(80),
  ADD COLUMN IF NOT EXISTS "deliveryErrorText" text,
  ADD COLUMN IF NOT EXISTS "sentAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deliveredAt" timestamp(3),
  ADD COLUMN IF NOT EXISTS "failedAt" timestamp(3);

UPDATE "ChatMessage"
SET "sentAt" = COALESCE("sentAt", "createdAt")
WHERE "sentAt" IS NULL;

UPDATE "ChatMessage"
SET "deliveryStatus" = 'FAILED',
    "failedAt" = COALESCE("failedAt", NOW())
WHERE "deliveryStatus" IS NULL
  AND "deliveryErrorCode" IS NOT NULL;

UPDATE "ChatMessage"
SET "deliveryStatus" = 'DELIVERED',
    "deliveredAt" = COALESCE("deliveredAt", "createdAt")
WHERE "deliveryStatus" = 'SENT'
  AND EXISTS (
    SELECT 1
    FROM "ChatReadReceipt" r
    WHERE r."messageId" = "ChatMessage"."id"
  );

CREATE INDEX IF NOT EXISTS "ChatMessage_clientMessageId_idx" ON "ChatMessage"("clientMessageId");
CREATE INDEX IF NOT EXISTS "ChatMessage_chatRoomId_deliveryStatus_createdAt_desc_idx"
  ON "ChatMessage"("chatRoomId", "deliveryStatus", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessage_chatRoomId_senderId_clientMessageId_key"
  ON "ChatMessage"("chatRoomId", "senderId", "clientMessageId");

CREATE INDEX IF NOT EXISTS "ChatMessage_fts_simple_idx"
  ON "ChatMessage"
  USING GIN (to_tsvector('simple', COALESCE("body", '') || ' ' || COALESCE("metadata"::text, '')));
