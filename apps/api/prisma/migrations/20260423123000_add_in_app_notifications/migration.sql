DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InAppNotificationKind') THEN
    CREATE TYPE "InAppNotificationKind" AS ENUM ('PUBLIC', 'PERSONAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InAppNotificationMediaType') THEN
    CREATE TYPE "InAppNotificationMediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'FILE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InAppNotificationTargetType') THEN
    CREATE TYPE "InAppNotificationTargetType" AS ENUM ('ALL', 'USER', 'GROUP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InAppNotificationGroupType') THEN
    CREATE TYPE "InAppNotificationGroupType" AS ENUM ('NEW_USERS', 'NO_ORDERS', 'ONE_ORDER', 'ROLE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InAppNotificationPriority') THEN
    CREATE TYPE "InAppNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "InAppNotification" (
  "id" text NOT NULL,
  "kind" "InAppNotificationKind" NOT NULL,
  "sourceCategory" varchar(50) NOT NULL,
  "sourceRefId" varchar(120),
  "title" varchar(200) NOT NULL,
  "body" text,
  "mediaType" "InAppNotificationMediaType",
  "mediaUrl" text,
  "fileName" varchar(255),
  "actionUrl" text,
  "payload" jsonb,
  "priority" "InAppNotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "targetType" "InAppNotificationTargetType" NOT NULL DEFAULT 'USER',
  "targetUserId" text,
  "targetRoleKey" varchar(80),
  "targetGroup" "InAppNotificationGroupType",
  "targetCriteria" jsonb,
  "dedupeKey" varchar(180),
  "createdById" text,
  "scheduledAt" timestamp(3),
  "publishedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" timestamp(3),
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InAppNotificationRecipient" (
  "id" text NOT NULL,
  "notificationId" text NOT NULL,
  "userId" text NOT NULL,
  "isRead" boolean NOT NULL DEFAULT false,
  "readAt" timestamp(3),
  "isArchived" boolean NOT NULL DEFAULT false,
  "archivedAt" timestamp(3),
  "deliveredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "InAppNotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InAppNotificationRecipient_notificationId_userId_key"
  ON "InAppNotificationRecipient" ("notificationId", "userId");

CREATE INDEX IF NOT EXISTS "InAppNotification_kind_idx" ON "InAppNotification" ("kind");
CREATE INDEX IF NOT EXISTS "InAppNotification_sourceCategory_idx" ON "InAppNotification" ("sourceCategory");
CREATE INDEX IF NOT EXISTS "InAppNotification_targetType_idx" ON "InAppNotification" ("targetType");
CREATE INDEX IF NOT EXISTS "InAppNotification_targetGroup_idx" ON "InAppNotification" ("targetGroup");
CREATE INDEX IF NOT EXISTS "InAppNotification_targetUserId_idx" ON "InAppNotification" ("targetUserId");
CREATE INDEX IF NOT EXISTS "InAppNotification_targetRoleKey_idx" ON "InAppNotification" ("targetRoleKey");
CREATE INDEX IF NOT EXISTS "InAppNotification_createdById_idx" ON "InAppNotification" ("createdById");
CREATE INDEX IF NOT EXISTS "InAppNotification_publishedAt_idx" ON "InAppNotification" ("publishedAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_expiresAt_idx" ON "InAppNotification" ("expiresAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_isActive_idx" ON "InAppNotification" ("isActive");
CREATE INDEX IF NOT EXISTS "InAppNotification_dedupeKey_idx" ON "InAppNotification" ("dedupeKey");

CREATE INDEX IF NOT EXISTS "InAppNotificationRecipient_notificationId_idx"
  ON "InAppNotificationRecipient" ("notificationId");
CREATE INDEX IF NOT EXISTS "InAppNotificationRecipient_userId_idx"
  ON "InAppNotificationRecipient" ("userId");
CREATE INDEX IF NOT EXISTS "InAppNotificationRecipient_userId_isRead_idx"
  ON "InAppNotificationRecipient" ("userId", "isRead");
CREATE INDEX IF NOT EXISTS "InAppNotificationRecipient_userId_deliveredAt_desc_idx"
  ON "InAppNotificationRecipient" ("userId", "deliveredAt" DESC);
CREATE INDEX IF NOT EXISTS "InAppNotificationRecipient_userId_createdAt_desc_idx"
  ON "InAppNotificationRecipient" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "InAppNotificationRecipient_isArchived_idx"
  ON "InAppNotificationRecipient" ("isArchived");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InAppNotification_createdById_fkey'
  ) THEN
    ALTER TABLE "InAppNotification"
      ADD CONSTRAINT "InAppNotification_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InAppNotificationRecipient_notificationId_fkey'
  ) THEN
    ALTER TABLE "InAppNotificationRecipient"
      ADD CONSTRAINT "InAppNotificationRecipient_notificationId_fkey"
      FOREIGN KEY ("notificationId") REFERENCES "InAppNotification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InAppNotificationRecipient_userId_fkey'
  ) THEN
    ALTER TABLE "InAppNotificationRecipient"
      ADD CONSTRAINT "InAppNotificationRecipient_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
