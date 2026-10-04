ALTER TABLE "BorrowTransaction" ADD CONSTRAINT "borrower_required" CHECK (length(trim("borrowerName")) > 0 AND length(trim("purpose")) > 0);
CREATE OR REPLACE FUNCTION hm_protect_incident() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Incident records cannot be deleted'; END IF;
  IF (to_jsonb(NEW)-ARRAY['status','updatedAt','actionTaken','remarks']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updatedAt','actionTaken','remarks']) THEN RAISE EXCEPTION 'Incident identity and original facts are immutable'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION hm_check_return_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE return_id TEXT; row_data RECORD;
BEGIN
  IF TG_TABLE_NAME='ReturnTransaction' THEN return_id:=NEW."id";
  ELSIF TG_TABLE_NAME='ReturnTransactionItem' THEN return_id:=NEW."returnTransactionId";
  ELSE
    IF NEW."returnItemId" IS NULL THEN RETURN NULL; END IF;
    SELECT "returnTransactionId" INTO return_id FROM "ReturnTransactionItem" WHERE "id"=NEW."returnItemId";
  END IF;
  IF NOT EXISTS(SELECT 1 FROM "ReturnTransactionItem" WHERE "returnTransactionId"=return_id) THEN RAISE EXCEPTION 'A return transaction must contain items'; END IF;
  FOR row_data IN SELECT r.*, b."inventoryItemId", t."returnDate" FROM "ReturnTransactionItem" r JOIN "BorrowTransactionItem" b ON b."id"=r."borrowTransactionItemId" JOIN "ReturnTransaction" t ON t."id"=r."returnTransactionId" WHERE r."returnTransactionId"=return_id LOOP
    IF row_data."returnCondition"='DAMAGED' THEN
      IF NOT EXISTS(SELECT 1 FROM "DamageRecord" WHERE "returnItemId"=row_data."id" AND "itemId"=row_data."inventoryItemId" AND "quantity"=row_data."quantityReturned" AND "dateReported"=row_data."returnDate") THEN RAISE EXCEPTION 'Damaged returns require a matching damage record'; END IF;
    ELSIF EXISTS(SELECT 1 FROM "DamageRecord" WHERE "returnItemId"=row_data."id") THEN RAISE EXCEPTION 'Usable or lost returns cannot have a damage record'; END IF;
    IF row_data."returnCondition"='LOST_MISSING' THEN
      IF NOT EXISTS(SELECT 1 FROM "LostItemRecord" WHERE "returnItemId"=row_data."id" AND "itemId"=row_data."inventoryItemId" AND "quantity"=row_data."quantityReturned" AND "dateReported"=row_data."returnDate") THEN RAISE EXCEPTION 'Lost dispositions require a matching missing record'; END IF;
    ELSIF EXISTS(SELECT 1 FROM "LostItemRecord" WHERE "returnItemId"=row_data."id") THEN RAISE EXCEPTION 'Usable or damaged returns cannot have a missing record'; END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_return_integrity_header AFTER INSERT ON "ReturnTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_return_integrity();
CREATE CONSTRAINT TRIGGER check_return_integrity_line AFTER INSERT ON "ReturnTransactionItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_return_integrity();
CREATE CONSTRAINT TRIGGER check_return_damage AFTER INSERT OR UPDATE ON "DamageRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_return_integrity();
CREATE CONSTRAINT TRIGGER check_return_loss AFTER INSERT OR UPDATE ON "LostItemRecord" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hm_check_return_integrity();
