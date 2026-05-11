DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatMessageVersionAction') THEN
    CREATE TYPE "ChatMessageVersionAction" AS ENUM ('CREATE', 'EDIT', 'DELETE');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ChatMessageVersion" (
  "id" text NOT NULL,
  "messageId" text NOT NULL,
  "versionNo" integer NOT NULL,
  "action" "ChatMessageVersionAction" NOT NULL,
  "body" text,
  "metadata" jsonb,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3),
  "editedById" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessageVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatMessageVersion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatMessageVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ChatMessageReaction" (
  "id" text NOT NULL,
  "messageId" text NOT NULL,
  "userId" text NOT NULL,
  "reaction" varchar(32) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessageReaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ChatMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessageVersion_messageId_versionNo_key" ON "ChatMessageVersion"("messageId", "versionNo");
CREATE INDEX IF NOT EXISTS "ChatMessageVersion_messageId_createdAt_desc_idx" ON "ChatMessageVersion"("messageId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ChatMessageVersion_editedById_idx" ON "ChatMessageVersion"("editedById");

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMessageReaction_messageId_userId_key" ON "ChatMessageReaction"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "ChatMessageReaction_messageId_reaction_idx" ON "ChatMessageReaction"("messageId", "reaction");
CREATE INDEX IF NOT EXISTS "ChatMessageReaction_userId_idx" ON "ChatMessageReaction"("userId");

CREATE INDEX IF NOT EXISTS "ChatMessage_isDeleted_createdAt_idx" ON "ChatMessage"("isDeleted", "createdAt");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "ChatMessage_body_trgm_idx" ON "ChatMessage" USING gin ("body" gin_trgm_ops) WHERE "body" IS NOT NULL;
