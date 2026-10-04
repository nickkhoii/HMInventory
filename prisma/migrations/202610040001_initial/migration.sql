-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'FOR_REPAIR', 'LOST_MISSING', 'DISPOSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INITIAL', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'DAMAGE', 'REPAIR', 'LOST', 'RECOVERY', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "DamageStatus" AS ENUM ('FOR_ASSESSMENT', 'FOR_REPAIR', 'REPAIRED', 'BEYOND_REPAIR', 'DISPOSED');

-- CreateEnum
CREATE TYPE "LostStatus" AS ENUM ('MISSING', 'UNDER_INVESTIGATION', 'RECOVERED', 'DECLARED_LOST');

-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "inventoryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dateAcquired" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT '',
    "condition" "Condition" NOT NULL DEFAULT 'GOOD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "previousAvailable" INTEGER NOT NULL,
    "newAvailable" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT '',
    "referenceNumber" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageRecord" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dateReported" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL DEFAULT '',
    "status" "DamageStatus" NOT NULL DEFAULT 'FOR_ASSESSMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DamageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostItemRecord" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dateReported" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "status" "LostStatus" NOT NULL DEFAULT 'MISSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostItemRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisposalRecord" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "disposalDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisposalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "previous" "Condition",
    "current" "Condition" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "institutionName" TEXT NOT NULL DEFAULT 'Hospitality Management',
    "laboratoryName" TEXT NOT NULL DEFAULT 'HM Laboratory',
    "reportHeader" TEXT NOT NULL DEFAULT 'HM Laboratory Inventory Management System',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_inventoryCode_key" ON "InventoryItem"("inventoryCode");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_locationId_idx" ON "InventoryItem"("categoryId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryItem_isActive_updatedAt_idx" ON "InventoryItem"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_transactionNumber_key" ON "InventoryTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "InventoryTransaction_itemId_transactionDate_idx" ON "InventoryTransaction"("itemId", "transactionDate");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_transactionDate_idx" ON "InventoryTransaction"("type", "transactionDate");

-- CreateIndex
CREATE INDEX "DamageRecord_itemId_status_idx" ON "DamageRecord"("itemId", "status");

-- CreateIndex
CREATE INDEX "LostItemRecord_itemId_status_idx" ON "LostItemRecord"("itemId", "status");

-- CreateIndex
CREATE INDEX "DisposalRecord_itemId_disposalDate_idx" ON "DisposalRecord"("itemId", "disposalDate");

-- CreateIndex
CREATE INDEX "ConditionHistory_itemId_createdAt_idx" ON "ConditionHistory"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageRecord" ADD CONSTRAINT "DamageRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostItemRecord" ADD CONSTRAINT "LostItemRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalRecord" ADD CONSTRAINT "DisposalRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionHistory" ADD CONSTRAINT "ConditionHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
