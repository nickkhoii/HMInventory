-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('STUDENT', 'FACULTY', 'STAFF', 'DEPARTMENT', 'ORGANIZATION', 'OTHER');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('BORROWED', 'PARTIALLY_RETURNED', 'RETURNED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'FAIR', 'DAMAGED', 'LOST_MISSING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'BORROW';
ALTER TYPE "TransactionType" ADD VALUE 'RETURN';
ALTER TYPE "TransactionType" ADD VALUE 'BORROW_CANCEL';

-- AlterTable
ALTER TABLE "DamageRecord" ADD COLUMN     "returnItemId" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "borrowedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "borrowTransactionId" TEXT,
ADD COLUMN     "returnTransactionId" TEXT;

-- AlterTable
ALTER TABLE "LostItemRecord" ADD COLUMN     "returnItemId" TEXT;

-- CreateTable
CREATE TABLE "BorrowTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "requestId" TEXT,
    "requestHash" TEXT,
    "borrowerName" TEXT NOT NULL,
    "borrowerType" "BorrowerType" NOT NULL,
    "borrowerIdNumber" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "program" TEXT NOT NULL DEFAULT '',
    "yearSection" TEXT NOT NULL DEFAULT '',
    "contactNumber" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL,
    "borrowedDate" DATE NOT NULL,
    "expectedReturnDate" DATE NOT NULL,
    "finalReturnDate" DATE,
    "status" "BorrowStatus" NOT NULL DEFAULT 'BORROWED',
    "remarks" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BorrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorrowTransactionItem" (
    "id" TEXT NOT NULL,
    "borrowTransactionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "inventoryCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityBorrowed" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "quantityCancelled" INTEGER NOT NULL DEFAULT 0,
    "conditionBeforeRelease" "Condition" NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BorrowTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnTransaction" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "requestId" TEXT,
    "requestHash" TEXT,
    "borrowTransactionId" TEXT NOT NULL,
    "returnDate" DATE NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnTransactionItem" (
    "id" TEXT NOT NULL,
    "returnTransactionId" TEXT NOT NULL,
    "borrowTransactionItemId" TEXT NOT NULL,
    "quantityReturned" INTEGER NOT NULL,
    "returnCondition" "ReturnCondition" NOT NULL,
    "damageDescription" TEXT NOT NULL DEFAULT '',
    "actionRequired" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ReturnTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BorrowTransaction_transactionNumber_key" ON "BorrowTransaction"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BorrowTransaction_requestId_key" ON "BorrowTransaction"("requestId");

-- CreateIndex
CREATE INDEX "BorrowTransaction_status_expectedReturnDate_idx" ON "BorrowTransaction"("status", "expectedReturnDate");

-- CreateIndex
CREATE INDEX "BorrowTransaction_borrowerType_borrowedDate_idx" ON "BorrowTransaction"("borrowerType", "borrowedDate");

-- CreateIndex
CREATE INDEX "BorrowTransaction_borrowerName_idx" ON "BorrowTransaction"("borrowerName");

-- CreateIndex
CREATE INDEX "BorrowTransaction_borrowerIdNumber_idx" ON "BorrowTransaction"("borrowerIdNumber");

-- CreateIndex
CREATE INDEX "BorrowTransactionItem_inventoryItemId_idx" ON "BorrowTransactionItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BorrowTransactionItem_borrowTransactionId_inventoryItemId_key" ON "BorrowTransactionItem"("borrowTransactionId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnTransaction_returnNumber_key" ON "ReturnTransaction"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnTransaction_requestId_key" ON "ReturnTransaction"("requestId");

-- CreateIndex
CREATE INDEX "ReturnTransaction_borrowTransactionId_returnDate_idx" ON "ReturnTransaction"("borrowTransactionId", "returnDate");

-- CreateIndex
CREATE INDEX "ReturnTransactionItem_borrowTransactionItemId_idx" ON "ReturnTransactionItem"("borrowTransactionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DamageRecord_returnItemId_key" ON "DamageRecord"("returnItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LostItemRecord_returnItemId_key" ON "LostItemRecord"("returnItemId");

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_borrowTransactionId_fkey" FOREIGN KEY ("borrowTransactionId") REFERENCES "BorrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_returnTransactionId_fkey" FOREIGN KEY ("returnTransactionId") REFERENCES "ReturnTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageRecord" ADD CONSTRAINT "DamageRecord_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnTransactionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostItemRecord" ADD CONSTRAINT "LostItemRecord_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnTransactionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowTransactionItem" ADD CONSTRAINT "BorrowTransactionItem_borrowTransactionId_fkey" FOREIGN KEY ("borrowTransactionId") REFERENCES "BorrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowTransactionItem" ADD CONSTRAINT "BorrowTransactionItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransaction" ADD CONSTRAINT "ReturnTransaction_borrowTransactionId_fkey" FOREIGN KEY ("borrowTransactionId") REFERENCES "BorrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransactionItem" ADD CONSTRAINT "ReturnTransactionItem_returnTransactionId_fkey" FOREIGN KEY ("returnTransactionId") REFERENCES "ReturnTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnTransactionItem" ADD CONSTRAINT "ReturnTransactionItem_borrowTransactionItemId_fkey" FOREIGN KEY ("borrowTransactionItemId") REFERENCES "BorrowTransactionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE hm_borrow_number;
CREATE SEQUENCE hm_return_number;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "borrowed_quantity_valid" CHECK ("borrowedQuantity" >= 0 AND "borrowedQuantity" <= "quantity");
ALTER TABLE "BorrowTransaction" ADD CONSTRAINT "borrow_dates_valid" CHECK ("expectedReturnDate" >= "borrowedDate" AND ("finalReturnDate" IS NULL OR "finalReturnDate" >= "borrowedDate"));
ALTER TABLE "BorrowTransactionItem" ADD CONSTRAINT "borrow_line_quantities" CHECK ("quantityBorrowed" > 0 AND "quantityReturned" >= 0 AND "quantityCancelled" >= 0 AND "quantityReturned" + "quantityCancelled" <= "quantityBorrowed");
ALTER TABLE "BorrowTransactionItem" ADD CONSTRAINT "borrow_release_condition" CHECK ("conditionBeforeRelease" IN ('NEW','GOOD','FAIR'));
ALTER TABLE "ReturnTransactionItem" ADD CONSTRAINT "return_positive_quantity" CHECK ("quantityReturned" > 0);
CREATE TRIGGER immutable_return BEFORE UPDATE OR DELETE ON "ReturnTransaction" FOR EACH ROW EXECUTE FUNCTION hm_reject_audit_mutation();
CREATE TRIGGER immutable_return_item BEFORE UPDATE OR DELETE ON "ReturnTransactionItem" FOR EACH ROW EXECUTE FUNCTION hm_reject_audit_mutation();

CREATE FUNCTION hm_protect_borrow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Borrowing records cannot be deleted'; END IF;
 IF TG_TABLE_NAME='BorrowTransaction' THEN
   IF (to_jsonb(NEW) - ARRAY['status','finalReturnDate','cancelReason','cancelledAt','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','finalReturnDate','cancelReason','cancelledAt','updatedAt']) THEN RAISE EXCEPTION 'Original borrowing facts are immutable'; END IF;
 ELSE
   IF (to_jsonb(NEW) - ARRAY['quantityReturned','quantityCancelled']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['quantityReturned','quantityCancelled']) OR NEW."quantityReturned" < OLD."quantityReturned" OR NEW."quantityCancelled" < OLD."quantityCancelled" THEN RAISE EXCEPTION 'Original borrowed item facts are immutable'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_borrow BEFORE UPDATE OR DELETE ON "BorrowTransaction" FOR EACH ROW EXECUTE FUNCTION hm_protect_borrow();
CREATE TRIGGER protect_borrow_item BEFORE UPDATE OR DELETE ON "BorrowTransactionItem" FOR EACH ROW EXECUTE FUNCTION hm_protect_borrow();

CREATE OR REPLACE FUNCTION hm_check_unavailable_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item_id TEXT; held INTEGER; available INTEGER; borrowed INTEGER; loan_units BIGINT; unavailable BIGINT;
BEGIN
 IF TG_TABLE_NAME='InventoryItem' THEN item_id:=NEW."id";
 ELSIF TG_TABLE_NAME='BorrowTransactionItem' THEN item_id:=NEW."inventoryItemId";
 ELSE item_id:=NEW."itemId"; END IF;
 SELECT "quantity","availableQuantity","borrowedQuantity" INTO held,available,borrowed FROM "InventoryItem" WHERE "id"=item_id FOR UPDATE;
 SELECT COALESCE(SUM("quantityBorrowed"-"quantityReturned"-"quantityCancelled"),0) INTO loan_units FROM "BorrowTransactionItem" WHERE "inventoryItemId"=item_id;
 SELECT COALESCE((SELECT SUM("quantity") FROM "DamageRecord" WHERE "itemId"=item_id AND "status" NOT IN ('REPAIRED','DISPOSED')),0)+COALESCE((SELECT SUM("quantity") FROM "LostItemRecord" WHERE "itemId"=item_id AND "status"<>'RECOVERED'),0)+loan_units INTO unavailable;
 IF borrowed<>loan_units OR held-available<>unavailable THEN RAISE EXCEPTION 'Unavailable quantity must match borrowed units and unresolved incident records'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_borrow_inventory AFTER INSERT OR UPDATE ON "BorrowTransactionItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_unavailable_balance();

CREATE FUNCTION hm_check_borrow_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE borrow_id TEXT; row_data "BorrowTransaction"%ROWTYPE; borrowed BIGINT; returned BIGINT; cancelled BIGINT; line_count BIGINT; actual DATE;
BEGIN
 IF TG_TABLE_NAME='BorrowTransaction' THEN borrow_id:=NEW."id";
 ELSIF TG_TABLE_NAME IN ('BorrowTransactionItem','ReturnTransaction') THEN borrow_id:=NEW."borrowTransactionId";
 ELSE SELECT "borrowTransactionId" INTO borrow_id FROM "BorrowTransactionItem" WHERE "id"=NEW."borrowTransactionItemId"; END IF;
 SELECT * INTO row_data FROM "BorrowTransaction" WHERE "id"=borrow_id;
 SELECT COUNT(*),COALESCE(SUM("quantityBorrowed"),0),COALESCE(SUM("quantityReturned"),0),COALESCE(SUM("quantityCancelled"),0) INTO line_count,borrowed,returned,cancelled FROM "BorrowTransactionItem" WHERE "borrowTransactionId"=borrow_id;
 IF line_count=0 THEN RAISE EXCEPTION 'A borrowing transaction must contain items'; END IF;
 IF EXISTS(SELECT 1 FROM "BorrowTransactionItem" b WHERE b."borrowTransactionId"=borrow_id AND b."quantityReturned"<>COALESCE((SELECT SUM(r."quantityReturned") FROM "ReturnTransactionItem" r WHERE r."borrowTransactionItemId"=b."id"),0)) THEN RAISE EXCEPTION 'Returned quantities must match permanent return records'; END IF;
 IF EXISTS(SELECT 1 FROM "ReturnTransactionItem" r JOIN "BorrowTransactionItem" b ON b."id"=r."borrowTransactionItemId" JOIN "ReturnTransaction" t ON t."id"=r."returnTransactionId" WHERE b."borrowTransactionId"=borrow_id AND (t."borrowTransactionId"<>borrow_id OR t."returnDate"<row_data."borrowedDate")) THEN RAISE EXCEPTION 'Return must belong to the borrowing transaction and follow release'; END IF;
 SELECT MAX("returnDate") INTO actual FROM "ReturnTransaction" WHERE "borrowTransactionId"=borrow_id;
 IF row_data."status"='CANCELLED' THEN
   IF returned<>0 OR cancelled<>borrowed OR row_data."cancelledAt" IS NULL OR length(trim(row_data."cancelReason"))=0 OR row_data."finalReturnDate" IS NOT NULL THEN RAISE EXCEPTION 'Invalid cancellation state'; END IF;
 ELSIF cancelled<>0 THEN RAISE EXCEPTION 'Cancelled quantities require cancellation status';
 ELSIF returned=borrowed THEN
   IF row_data."status"<>'RETURNED' OR row_data."finalReturnDate" IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Complete returns require returned status and final date'; END IF;
 ELSIF returned>0 THEN
   IF row_data."status"<>'PARTIALLY_RETURNED' OR row_data."finalReturnDate" IS NOT NULL THEN RAISE EXCEPTION 'Outstanding quantities require partially returned status'; END IF;
 ELSE
   IF row_data."status"<>'BORROWED' OR row_data."finalReturnDate" IS NOT NULL THEN RAISE EXCEPTION 'Outstanding quantities require borrowed status'; END IF;
 END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_borrow_header AFTER INSERT OR UPDATE ON "BorrowTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_borrow_state();
CREATE CONSTRAINT TRIGGER check_borrow_lines AFTER INSERT OR UPDATE ON "BorrowTransactionItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_borrow_state();
CREATE CONSTRAINT TRIGGER check_return_header AFTER INSERT ON "ReturnTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_borrow_state();
CREATE CONSTRAINT TRIGGER check_return_lines AFTER INSERT ON "ReturnTransactionItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_borrow_state();
