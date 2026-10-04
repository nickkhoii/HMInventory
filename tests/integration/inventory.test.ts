import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../lib/db";
import {
  saveItem,
  recordMovement,
  archiveItem,
} from "../../lib/inventory-service";
import { generateReport, csvCell } from "../../lib/reports";
import { dashboard, listInventory } from "../../lib/queries";
import { assertTestDatabase } from "../../lib/test-database";
const suffix = randomUUID().slice(0, 8);
let categoryId: string, locationId: string, itemId: string;
const itemInput = () => ({
  inventoryCode: `TEST-${suffix}`,
  name: `Integration Mixer ${suffix}`,
  categoryId,
  locationId,
  unit: "piece",
  quantity: 20,
  minimumStock: 5,
  unitCost: 100,
  dateAcquired: "2026-10-04",
  condition: "GOOD",
});
const movement = (
  type: string,
  quantity: number,
  extras: Record<string, unknown> = {},
) => ({
  itemId,
  type,
  quantity,
  date: "2026-10-04",
  reason: "Integration verification",
  purpose: "Laboratory use",
  method: "Approved recycling",
  ...(type === "STOCK_IN" ? { unitCost: 110 } : {}),
  ...extras,
});
beforeAll(async () => {
  assertTestDatabase(process.env.DATABASE_URL);
  categoryId = (
    await db.category.create({ data: { name: `Test category ${suffix}` } })
  ).id;
  locationId = (
    await db.location.create({ data: { name: `Test location ${suffix}` } })
  ).id;
});
afterAll(() => db.$disconnect());
describe("PostgreSQL inventory workflows", () => {
  it("creates inventory with history and calculated value", async () => {
    const item = await saveItem(itemInput());
    itemId = item.id;
    expect(item.availableQuantity).toBe(20);
    expect(Number(item.totalValue)).toBe(2000);
    expect(await db.inventoryTransaction.count({ where: { itemId } })).toBe(1);
  });
  it("enforces unique inventory codes", async () => {
    await expect(saveItem(itemInput())).rejects.toThrow();
  });
  it("edits metadata and retains condition history", async () => {
    await saveItem(
      { ...itemInput(), condition: "FAIR", notes: "Checked" },
      itemId,
    );
    expect(await db.conditionHistory.count({ where: { itemId } })).toBe(2);
    await expect(
      saveItem({ ...itemInput(), quantity: 22 }, itemId),
    ).rejects.toThrow("stock operations");
  });
  it("stock-in updates balances and valuation", async () => {
    await recordMovement(movement("STOCK_IN", 5, { unitCost: 110 }));
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.quantity).toBe(25);
    expect(Number(item.totalValue)).toBe(2750);
  });
  it("stock-out updates balances", async () => {
    await recordMovement(movement("STOCK_OUT", 3));
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
        .quantity,
    ).toBe(22);
  });
  it("rolls back rejected movements, including audit records", async () => {
    const before = await db.inventoryTransaction.count({ where: { itemId } }),
      logs = await db.activityLog.count();
    await expect(recordMovement(movement("STOCK_OUT", 100))).rejects.toThrow(
      "exceeds",
    );
    expect(await db.inventoryTransaction.count({ where: { itemId } })).toBe(
      before,
    );
    expect(await db.activityLog.count()).toBe(logs);
  });
  it("tracks damage without reducing held quantity", async () => {
    await recordMovement(movement("DAMAGE", 3));
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.quantity).toBe(22);
    expect(item.availableQuantity).toBe(19);
  });
  it("repairs a damage record exactly once", async () => {
    const r = await db.damageRecord.findFirstOrThrow({ where: { itemId } });
    await recordMovement(movement("REPAIR", 3, { recordId: r.id }));
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
        .availableQuantity,
    ).toBe(22);
    await expect(
      recordMovement(movement("REPAIR", 3, { recordId: r.id })),
    ).rejects.toThrow();
  });
  it("tracks and recovers missing units exactly once", async () => {
    await recordMovement(movement("LOST", 2));
    const r = await db.lostItemRecord.findFirstOrThrow({ where: { itemId } });
    await recordMovement(movement("RECOVERY", 2, { recordId: r.id }));
    await expect(
      recordMovement(movement("RECOVERY", 2, { recordId: r.id })),
    ).rejects.toThrow();
    expect(
      (await db.lostItemRecord.findUniqueOrThrow({ where: { id: r.id } }))
        .status,
    ).toBe("RECOVERED");
  });
  it("disposes unavailable damage without subtracting available stock", async () => {
    await recordMovement(movement("DAMAGE", 15));
    const r = await db.damageRecord.findFirstOrThrow({
      where: { itemId, status: "FOR_ASSESSMENT" },
    });
    await recordMovement(movement("DISPOSAL", 15, { recordId: r.id }));
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.quantity).toBe(7);
    expect(item.availableQuantity).toBe(7);
  });
  it("physical counts preserve existing unavailable units", async () => {
    await recordMovement(movement("LOST", 2));
    await recordMovement(movement("PHYSICAL_COUNT", 5));
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.quantity).toBe(7);
    expect(item.availableQuantity).toBe(5);
  });
  it("uses database-backed search, low stock and report filters", async () => {
    const p = new URLSearchParams({ search: suffix, stock: "LOW_STOCK" });
    expect((await listInventory(p)).items.some((i) => i.id === itemId)).toBe(
      true,
    );
    const report = await generateReport(
      new URLSearchParams({
        kind: "low-stock",
        category: categoryId,
        from: "2026-10-01",
        to: "2026-10-31",
      }),
    );
    expect(report.rows).toHaveLength(1);
    expect(report.totalQuantity).toBe(7);
    expect(report.totalValue).toBe("770.00");
    const excluded = await generateReport(
      new URLSearchParams({ category: categoryId, from: "2027-01-01" }),
    );
    expect(excluded.rows).toHaveLength(0);
  });
  it("prevents concurrent withdrawals from overspending", async () => {
    const result = await Promise.allSettled([
      recordMovement(movement("STOCK_OUT", 4)),
      recordMovement(movement("STOCK_OUT", 4)),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
        .availableQuantity,
    ).toBe(1);
  });
  it("archives/restores without removing history", async () => {
    await archiveItem(itemId, false);
    await expect(recordMovement(movement("STOCK_IN", 1))).rejects.toThrow(
      "Restore",
    );
    expect(
      (await listInventory(new URLSearchParams({ search: suffix }))).total,
    ).toBe(0);
    await archiveItem(itemId, true);
    expect(
      await db.inventoryTransaction.count({ where: { itemId } }),
    ).toBeGreaterThan(5);
  });
  it("database rejects negative balances and additional administrators", async () => {
    await expect(
      db.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.admin.create({
        data: {
          id: 2,
          username: `second-${suffix}`,
          name: "Invalid",
          passwordHash: "invalid",
        },
      }),
    ).rejects.toThrow();
  });
  it("database rejects audit log mutation", async () => {
    const log = await db.activityLog.findFirstOrThrow();
    await expect(
      db.activityLog.update({
        where: { id: log.id },
        data: { description: "Tampered" },
      }),
    ).rejects.toThrow();
  });
  it("dashboard reads current database values", async () => {
    const result = await dashboard();
    expect(result.cards["Inventory items"]).toBeGreaterThan(0);
    expect(
      result.byCategory.some((c) => c.name === `Test category ${suffix}`),
    ).toBe(true);
  });
  it("neutralizes CSV spreadsheet formulas", () => {
    expect(csvCell('=IMPORTDATA("bad")')).toContain("'=IMPORTDATA");
  });
  it("deduplicates concurrent movement retries and rejects changed payloads", async () => {
    const item = await saveItem({
      ...itemInput(),
      inventoryCode: `RETRY-${suffix}`,
      quantity: 5,
    });
    const input = {
      ...movement("STOCK_IN", 2),
      itemId: item.id,
      requestId: randomUUID(),
    };
    const results = await Promise.all([
      recordMovement(input),
      recordMovement(input),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .quantity,
    ).toBe(7);
    await expect(recordMovement({ ...input, quantity: 3 })).rejects.toThrow(
      "different values",
    );
  });
  it("prevents condition edits from bypassing incident accounting and detects stale edits", async () => {
    const item = await saveItem({
      ...itemInput(),
      inventoryCode: `EDIT-${suffix}`,
    });
    await expect(
      saveItem(
        {
          ...itemInput(),
          inventoryCode: item.inventoryCode,
          condition: "DAMAGED",
        },
        item.id,
      ),
    ).rejects.toThrow("records");
    await recordMovement({ ...movement("STOCK_IN", 1), itemId: item.id });
    await expect(
      saveItem(
        {
          ...itemInput(),
          inventoryCode: item.inventoryCode,
          quantity: 21,
          expectedUpdatedAt: item.updatedAt.toISOString(),
        },
        item.id,
      ),
    ).rejects.toThrow("changed");
  });
  it("restores usable condition after stock-in to fully disposed inventory", async () => {
    const item = await saveItem({
      ...itemInput(),
      inventoryCode: `DISPOSE-${suffix}`,
      quantity: 1,
    });
    await recordMovement({ ...movement("DISPOSAL", 1), itemId: item.id });
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .condition,
    ).toBe("DISPOSED");
    await recordMovement({ ...movement("STOCK_IN", 1), itemId: item.id });
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }))
        .condition,
    ).toBe("GOOD");
  });
  it("preserves unavailable balances and incident identity in the database", async () => {
    const item = await saveItem({
      ...itemInput(),
      inventoryCode: `BALANCE-${suffix}`,
      quantity: 2,
    });
    await expect(
      db.inventoryItem.update({
        where: { id: item.id },
        data: { availableQuantity: 1 },
      }),
    ).rejects.toThrow("Unavailable quantity");
    await recordMovement({ ...movement("DAMAGE", 1), itemId: item.id });
    const incident = await db.damageRecord.findFirstOrThrow({
      where: { itemId: item.id },
    });
    await expect(
      db.damageRecord.update({
        where: { id: incident.id },
        data: { quantity: 2 },
      }),
    ).rejects.toThrow("immutable");
    await expect(
      db.damageRecord.delete({ where: { id: incident.id } }),
    ).rejects.toThrow("cannot be deleted");
    await expect(
      db.damageRecord.update({
        where: { id: incident.id },
        data: { status: "REPAIRED" },
      }),
    ).rejects.toThrow("Unavailable quantity");
  });
  it("requires reassessment before repairing beyond-repair incidents", async () => {
    const item = await saveItem({
      ...itemInput(),
      inventoryCode: `ASSESS-${suffix}`,
      quantity: 1,
    });
    await recordMovement({ ...movement("DAMAGE", 1), itemId: item.id });
    const incident = await db.damageRecord.findFirstOrThrow({
      where: { itemId: item.id },
    });
    await db.damageRecord.update({
      where: { id: incident.id },
      data: { status: "BEYOND_REPAIR" },
    });
    await expect(
      recordMovement({
        ...movement("REPAIR", 1, { recordId: incident.id }),
        itemId: item.id,
      }),
    ).rejects.toThrow("Reassess");
  });
  it("includes archived inventory in historical reports and clamps empty pages", async () => {
    const item = await saveItem({
      ...itemInput(),
      inventoryCode: `HISTORY-${suffix}`,
      name: `History ${suffix}`,
      quantity: 1,
    });
    await recordMovement({ ...movement("STOCK_OUT", 1), itemId: item.id });
    await archiveItem(item.id, false);
    const report = await generateReport(
      new URLSearchParams({ kind: "stock-out", search: `History ${suffix}` }),
    );
    expect(report.rows).toHaveLength(1);
    expect(
      (
        await listInventory(
          new URLSearchParams({ page: "999", search: `absent-${suffix}` }),
        )
      ).page,
    ).toBe(1);
  });
});
