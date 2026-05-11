-- CreateEnum
CREATE TYPE "ServiceExecutionType" AS ENUM ('AUTO', 'SEMI_AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('FIXED', 'RANGE', 'EXCHANGE_RATE');

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategoryMedia" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCategoryMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategorySEO" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT,
    "canonicalUrl" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "jsonLd" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategorySEO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDesc" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "coverImage" TEXT,
    "executionType" "ServiceExecutionType" NOT NULL,
    "requiresPanel" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlan" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVariant" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "stock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePrice" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "pricingType" "PricingType" NOT NULL,
    "price" DECIMAL(65,30),
    "minPrice" DECIMAL(65,30),
    "maxPrice" DECIMAL(65,30),
    "currency" TEXT,
    "exchangeSource" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFeature" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOperation" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMedia" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePlanMedia" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServicePlanMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFAQ" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFAQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "planId" TEXT,
    "variantId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "dislikesCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReviewAction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLike" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceReviewAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ServiceTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTagPivot" (
    "serviceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ServiceTagPivot_pkey" PRIMARY KEY ("serviceId","tagId")
);

-- CreateTable
CREATE TABLE "ServiceAttribute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "ServiceAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAttributeValue" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "serviceId" TEXT,
    "planId" TEXT,
    "variantId" TEXT,
    "value" TEXT NOT NULL,

    CONSTRAINT "ServiceAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSEO" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT,
    "canonicalUrl" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "jsonLd" JSONB,

    CONSTRAINT "ServiceSEO_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");
CREATE INDEX "ServiceCategory_parentId_idx" ON "ServiceCategory"("parentId");
CREATE INDEX "ServiceCategory_isActive_idx" ON "ServiceCategory"("isActive");
CREATE INDEX "ServiceCategory_sortOrder_idx" ON "ServiceCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceCategoryMedia_categoryId_idx" ON "ServiceCategoryMedia"("categoryId");
CREATE INDEX "ServiceCategoryMedia_sortOrder_idx" ON "ServiceCategoryMedia"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategorySEO_categoryId_key" ON "ServiceCategorySEO"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");
CREATE INDEX "Service_sortOrder_idx" ON "Service"("sortOrder");
CREATE INDEX "Service_createdAt_idx" ON "Service"("createdAt");

-- CreateIndex
CREATE INDEX "ServicePlan_serviceId_idx" ON "ServicePlan"("serviceId");
CREATE INDEX "ServicePlan_isActive_idx" ON "ServicePlan"("isActive");
CREATE INDEX "ServicePlan_sortOrder_idx" ON "ServicePlan"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceVariant_planId_idx" ON "ServiceVariant"("planId");
CREATE INDEX "ServiceVariant_isActive_idx" ON "ServiceVariant"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePrice_variantId_key" ON "ServicePrice"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceFeature_serviceId_key_key" ON "ServiceFeature"("serviceId", "key");
CREATE INDEX "ServiceFeature_serviceId_idx" ON "ServiceFeature"("serviceId");
CREATE INDEX "ServiceFeature_sortOrder_idx" ON "ServiceFeature"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOperation_serviceId_key_key" ON "ServiceOperation"("serviceId", "key");
CREATE INDEX "ServiceOperation_serviceId_idx" ON "ServiceOperation"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceMedia_serviceId_idx" ON "ServiceMedia"("serviceId");
CREATE INDEX "ServiceMedia_sortOrder_idx" ON "ServiceMedia"("sortOrder");

-- CreateIndex
CREATE INDEX "ServicePlanMedia_planId_idx" ON "ServicePlanMedia"("planId");
CREATE INDEX "ServicePlanMedia_sortOrder_idx" ON "ServicePlanMedia"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceFAQ_serviceId_idx" ON "ServiceFAQ"("serviceId");
CREATE INDEX "ServiceFAQ_sortOrder_idx" ON "ServiceFAQ"("sortOrder");

-- CreateIndex
CREATE INDEX "ServiceReview_userId_idx" ON "ServiceReview"("userId");
CREATE INDEX "ServiceReview_serviceId_idx" ON "ServiceReview"("serviceId");
CREATE INDEX "ServiceReview_planId_idx" ON "ServiceReview"("planId");
CREATE INDEX "ServiceReview_variantId_idx" ON "ServiceReview"("variantId");
CREATE INDEX "ServiceReview_status_idx" ON "ServiceReview"("status");
CREATE INDEX "ServiceReview_createdAt_idx" ON "ServiceReview"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReviewAction_reviewId_userId_key" ON "ServiceReviewAction"("reviewId", "userId");
CREATE INDEX "ServiceReviewAction_userId_idx" ON "ServiceReviewAction"("userId");
CREATE INDEX "ServiceReviewAction_createdAt_idx" ON "ServiceReviewAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTag_slug_key" ON "ServiceTag"("slug");

-- CreateIndex
CREATE INDEX "ServiceTagPivot_tagId_idx" ON "ServiceTagPivot"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAttribute_key_key" ON "ServiceAttribute"("key");

-- CreateIndex
CREATE INDEX "ServiceAttributeValue_attributeId_idx" ON "ServiceAttributeValue"("attributeId");
CREATE INDEX "ServiceAttributeValue_serviceId_idx" ON "ServiceAttributeValue"("serviceId");
CREATE INDEX "ServiceAttributeValue_planId_idx" ON "ServiceAttributeValue"("planId");
CREATE INDEX "ServiceAttributeValue_variantId_idx" ON "ServiceAttributeValue"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSEO_serviceId_key" ON "ServiceSEO"("serviceId");

-- CreateCheck
ALTER TABLE "ServiceReview"
ADD CONSTRAINT "ServiceReview_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);

-- CreateCheck
ALTER TABLE "ServiceReview"
ADD CONSTRAINT "ServiceReview_target_check" CHECK (num_nonnulls("serviceId", "planId", "variantId") = 1);

-- CreateCheck
ALTER TABLE "ServiceAttributeValue"
ADD CONSTRAINT "ServiceAttributeValue_target_check" CHECK (num_nonnulls("serviceId", "planId", "variantId") = 1);

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceCategoryMedia" ADD CONSTRAINT "ServiceCategoryMedia_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceCategorySEO" ADD CONSTRAINT "ServiceCategorySEO_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceVariant" ADD CONSTRAINT "ServiceVariant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePrice" ADD CONSTRAINT "ServicePrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceFeature" ADD CONSTRAINT "ServiceFeature_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOperation" ADD CONSTRAINT "ServiceOperation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePlanMedia" ADD CONSTRAINT "ServicePlanMedia_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceFAQ" ADD CONSTRAINT "ServiceFAQ_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReviewAction" ADD CONSTRAINT "ServiceReviewAction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ServiceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceReviewAction" ADD CONSTRAINT "ServiceReviewAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceTagPivot" ADD CONSTRAINT "ServiceTagPivot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceTagPivot" ADD CONSTRAINT "ServiceTagPivot_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ServiceTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAttributeValue" ADD CONSTRAINT "ServiceAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ServiceAttribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAttributeValue" ADD CONSTRAINT "ServiceAttributeValue_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceAttributeValue" ADD CONSTRAINT "ServiceAttributeValue_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServicePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceAttributeValue" ADD CONSTRAINT "ServiceAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ServiceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceSEO" ADD CONSTRAINT "ServiceSEO_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
