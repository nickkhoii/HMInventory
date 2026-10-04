ALTER TABLE "InventoryTransaction" ADD COLUMN "requestId" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "InventoryTransaction_requestId_key" ON "InventoryTransaction"("requestId");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "item_quantity_limit" CHECK ("quantity" <= 100000000 AND "minimumStock" <= 100000000);

-- Incident identity and quantities belong to the permanent inventory history.
CREATE FUNCTION hm_protect_incident() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Incident records cannot be deleted'; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."itemId" IS DISTINCT FROM OLD."itemId" OR NEW."quantity" IS DISTINCT FROM OLD."quantity" OR NEW."dateReported" IS DISTINCT FROM OLD."dateReported" OR NEW."description" IS DISTINCT FROM OLD."description" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Incident identity and original facts are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_damage BEFORE UPDATE OR DELETE ON "DamageRecord" FOR EACH ROW EXECUTE FUNCTION hm_protect_incident();
CREATE TRIGGER protect_loss BEFORE UPDATE OR DELETE ON "LostItemRecord" FOR EACH ROW EXECUTE FUNCTION hm_protect_incident();

-- Check at commit so an incident and its stock movement can be written atomically.
CREATE FUNCTION hm_check_unavailable_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item_id TEXT; held INTEGER; available INTEGER; unavailable BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'InventoryItem' THEN item_id := NEW."id"; ELSE item_id := NEW."itemId"; END IF;
  SELECT "quantity", "availableQuantity" INTO held, available FROM "InventoryItem" WHERE "id"=item_id FOR UPDATE;
  SELECT COALESCE((SELECT SUM("quantity") FROM "DamageRecord" WHERE "itemId"=item_id AND "status" NOT IN ('REPAIRED','DISPOSED')),0) + COALESCE((SELECT SUM("quantity") FROM "LostItemRecord" WHERE "itemId"=item_id AND "status" <> 'RECOVERED'),0) INTO unavailable;
  IF held - available <> unavailable THEN RAISE EXCEPTION 'Unavailable quantity must match unresolved incident records'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_item_balance AFTER INSERT OR UPDATE ON "InventoryItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_unavailable_balance();
CREATE CONSTRAINT TRIGGER check_damage_balance AFTER INSERT OR UPDATE ON "DamageRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_unavailable_balance();
CREATE CONSTRAINT TRIGGER check_loss_balance AFTER INSERT OR UPDATE ON "LostItemRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_unavailable_balance();
