ALTER TABLE "InventoryItem" ADD COLUMN "totalValue" DECIMAL(24,2) NOT NULL DEFAULT 0;
UPDATE "InventoryItem" SET "totalValue" = "quantity" * "unitCost";
CREATE INDEX "InventoryItem_totalValue_idx" ON "InventoryItem"("totalValue");
CREATE FUNCTION hm_calculate_value() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."totalValue" := NEW."quantity" * NEW."unitCost";
  RETURN NEW;
END;
$$;
CREATE TRIGGER calculate_inventory_value BEFORE INSERT OR UPDATE ON "InventoryItem" FOR EACH ROW EXECUTE FUNCTION hm_calculate_value();
