-- Enforce the single-account architecture and quantity invariants at database level.
ALTER TABLE "Admin" ADD CONSTRAINT "admin_singleton" CHECK ("id" = 1);
ALTER TABLE "Settings" ADD CONSTRAINT "settings_singleton" CHECK ("id" = 1);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "item_valid_quantities" CHECK ("quantity" >= 0 AND "availableQuantity" >= 0 AND "availableQuantity" <= "quantity" AND "minimumStock" >= 0 AND "unitCost" >= 0);
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "transaction_valid_quantities" CHECK ("quantity" >= 0 AND "previousQuantity" >= 0 AND "newQuantity" >= 0 AND "previousAvailable" >= 0 AND "newAvailable" >= 0 AND "previousAvailable" <= "previousQuantity" AND "newAvailable" <= "newQuantity" AND "unitCost" >= 0);
ALTER TABLE "DamageRecord" ADD CONSTRAINT "damage_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "LostItemRecord" ADD CONSTRAINT "lost_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "DisposalRecord" ADD CONSTRAINT "disposal_positive_quantity" CHECK ("quantity" > 0);

-- Immutable audit records may be inserted and read, never changed or deleted.
CREATE FUNCTION hm_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical audit records are immutable';
END;
$$;
CREATE TRIGGER immutable_activity BEFORE UPDATE OR DELETE ON "ActivityLog" FOR EACH ROW EXECUTE FUNCTION hm_reject_audit_mutation();
CREATE TRIGGER immutable_transaction BEFORE UPDATE OR DELETE ON "InventoryTransaction" FOR EACH ROW EXECUTE FUNCTION hm_reject_audit_mutation();
CREATE TRIGGER immutable_condition BEFORE UPDATE OR DELETE ON "ConditionHistory" FOR EACH ROW EXECUTE FUNCTION hm_reject_audit_mutation();
CREATE TRIGGER immutable_disposal BEFORE UPDATE OR DELETE ON "DisposalRecord" FOR EACH ROW EXECUTE FUNCTION hm_reject_audit_mutation();
