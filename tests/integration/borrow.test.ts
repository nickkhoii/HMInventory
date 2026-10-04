import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../lib/db";
import { assertTestDatabase } from "../../lib/test-database";
import { saveItem, recordMovement } from "../../lib/inventory-service";
import {
  createBorrow,
  recordReturn,
  cancelBorrow,
} from "../../lib/borrow-service";
import {
  borrowDetail,
  listBorrowing,
  borrowingDashboard,
} from "../../lib/borrow-queries";
import { laboratoryToday } from "../../lib/borrow-rules";
import { generateReport } from "../../lib/reports";
import { borrowReportKinds } from "../../lib/report-kinds";
const today = laboratoryToday(),
  prefix = randomUUID().slice(0, 8);
let categoryId: string, locationId: string;
beforeAll(async () => {
  assertTestDatabase(process.env.DATABASE_URL);
  categoryId = (
    await db.category.create({ data: { name: `Borrow category ${prefix}` } })
  ).id;
  locationId = (
    await db.location.create({ data: { name: `Borrow location ${prefix}` } })
  ).id;
});
afterAll(() => db.$disconnect());
async function item(quantity = 20) {
  return saveItem({
    inventoryCode: `BORROW-${randomUUID().slice(0, 8)}`,
    name: `Borrow fixture ${prefix}`,
    categoryId,
    locationId,
    unit: "piece",
    quantity,
    minimumStock: 2,
    unitCost: 10,
    dateAcquired: today,
    condition: "GOOD",
  });
}
const input = (items: { id: string; quantity?: number }[]) => ({
  requestId: randomUUID(),
  borrowerName: `Juan ${prefix}`,
  borrowerType: "STUDENT",
  borrowerIdNumber: `ID-${prefix}`,
  purpose: "Cooking laboratory",
  borrowedDate: today,
  expectedReturnDate: today,
  items: items.map((i) => ({
    inventoryItemId: i.id,
    quantity: i.quantity ?? 10,
    conditionBeforeRelease: "GOOD",
  })),
});
const returned = (
  borrowTransactionId: string,
  borrowTransactionItemId: string,
  quantity: number,
  returnCondition = "GOOD",
) => ({
  requestId: randomUUID(),
  borrowTransactionId,
  returnDate: today,
  items: [
    {
      borrowTransactionItemId,
      quantity,
      returnCondition,
      damageDescription: "Inspection findings",
      actionRequired: "Assess and repair",
    },
  ],
});
async function loan(quantity = 10) {
  const i = await item();
  const b = await createBorrow(input([{ id: i.id, quantity }]));
  return { item: i, borrow: await borrowDetail(b.id) };
}
describe("atomic borrowing and partial returns", () => {
  it("borrows multiple items in one loan and preserves total quantity", async () => {
    const a = await item(),
      b = await item();
    const result = await createBorrow(
      input([
        { id: a.id, quantity: 3 },
        { id: b.id, quantity: 5 },
      ]),
    );
    const detail = await borrowDetail(result.id);
    expect(detail.items).toHaveLength(2);
    expect(detail.quantityOutstanding).toBe(8);
    const updated = await db.inventoryItem.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect([
      updated.quantity,
      updated.availableQuantity,
      updated.borrowedQuantity,
    ]).toEqual([20, 17, 3]);
    expect(
      await db.inventoryTransaction.count({
        where: { borrowTransactionId: result.id, type: "BORROW" },
      }),
    ).toBe(2);
  });
  it("rolls back a multi-item loan if any item is insufficient", async () => {
    const a = await item(5),
      b = await item(1);
    await expect(
      createBorrow(
        input([
          { id: a.id, quantity: 3 },
          { id: b.id, quantity: 7 },
        ]),
      ),
    ).rejects.toThrow("Only 1 item(s)");
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: a.id } }))
        .availableQuantity,
    ).toBe(5);
  });
  it("supports partial and complete returns with exact balances and final date", async () => {
    const { item: i, borrow: b } = await loan();
    await recordReturn(returned(b.id, b.items[0].id, 6));
    let detail = await borrowDetail(b.id);
    expect([
      detail.status,
      detail.quantityReturned,
      detail.quantityOutstanding,
    ]).toEqual(["PARTIALLY_RETURNED", 6, 4]);
    expect(detail.finalReturnDate).toBeNull();
    let current = await db.inventoryItem.findUniqueOrThrow({
      where: { id: i.id },
    });
    expect([current.availableQuantity, current.borrowedQuantity]).toEqual([
      16, 4,
    ]);
    await recordReturn(returned(b.id, b.items[0].id, 4, "FAIR"));
    detail = await borrowDetail(b.id);
    expect(detail.status).toBe("RETURNED");
    expect(detail.quantityOutstanding).toBe(0);
    expect(detail.finalReturnDate?.toISOString().slice(0, 10)).toBe(today);
    current = await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } });
    expect([
      current.quantity,
      current.availableQuantity,
      current.borrowedQuantity,
      current.condition,
    ]).toEqual([20, 20, 0, "FAIR"]);
    expect(detail.returns).toHaveLength(2);
  });
  it("rejects combined return quantities above outstanding and rolls back", async () => {
    const { borrow: b } = await loan(5);
    const raw = returned(b.id, b.items[0].id, 4);
    raw.items.push({
      ...raw.items[0],
      quantity: 2,
      returnCondition: "DAMAGED",
    });
    await expect(recordReturn(raw)).rejects.toThrow("exceed outstanding");
    expect((await borrowDetail(b.id)).quantityOutstanding).toBe(5);
  });
  it("splits usable and damaged returns and links the damage to the borrower", async () => {
    const { item: i, borrow: b } = await loan(5);
    const raw = returned(b.id, b.items[0].id, 4);
    raw.items.push({
      ...raw.items[0],
      quantity: 1,
      returnCondition: "DAMAGED",
    });
    const ret = await recordReturn(raw);
    const current = await db.inventoryItem.findUniqueOrThrow({
      where: { id: i.id },
    });
    expect([
      current.quantity,
      current.availableQuantity,
      current.borrowedQuantity,
    ]).toEqual([20, 19, 0]);
    const damage = await db.damageRecord.findFirstOrThrow({
      where: { itemId: i.id },
      include: {
        returnItem: {
          include: {
            returnTransaction: { include: { borrowTransaction: true } },
          },
        },
      },
    });
    expect(damage.quantity).toBe(1);
    expect(damage.returnItem?.returnTransaction.borrowTransaction.id).toBe(
      b.id,
    );
    expect((await borrowDetail(b.id)).status).toBe("RETURNED");
    await recordMovement({
      itemId: i.id,
      type: "REPAIR",
      recordId: damage.id,
      quantity: 1,
      date: today,
      reason: "Repaired",
    });
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } }))
        .availableQuantity,
    ).toBe(20);
    expect(ret.id).toBeTruthy();
  });
  it("moves lost borrowed units to missing stock without restoring availability", async () => {
    const { item: i, borrow: b } = await loan(3);
    await recordReturn(returned(b.id, b.items[0].id, 3, "LOST_MISSING"));
    const current = await db.inventoryItem.findUniqueOrThrow({
      where: { id: i.id },
    });
    expect([current.availableQuantity, current.borrowedQuantity]).toEqual([
      17, 0,
    ]);
    const loss = await db.lostItemRecord.findFirstOrThrow({
      where: { itemId: i.id },
    });
    expect(loss.quantity).toBe(3);
    expect(loss.returnItemId).toBeTruthy();
    await recordMovement({
      itemId: i.id,
      type: "RECOVERY",
      recordId: loss.id,
      quantity: 3,
      date: today,
      reason: "Recovered",
    });
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } }))
        .availableQuantity,
    ).toBe(20);
  });
  it("computes overdue dynamically and clears it after return", async () => {
    const i = await item(2),
      past = new Date(Date.parse(today) - 2 * 86400000)
        .toISOString()
        .slice(0, 10);
    const raw = {
      ...input([{ id: i.id, quantity: 2 }]),
      borrowedDate: past,
      expectedReturnDate: past,
    };
    const b = await createBorrow(raw);
    let d = await borrowDetail(b.id);
    expect(d.status).toBe("OVERDUE");
    expect(d.daysOverdue).toBe(2);
    expect(
      (
        await listBorrowing(
          new URLSearchParams({
            status: "OVERDUE",
            search: b.transactionNumber,
          }),
        )
      ).total,
    ).toBe(1);
    await recordReturn(returned(b.id, d.items[0].id, 2));
    d = await borrowDetail(b.id);
    expect(d.status).toBe("RETURNED");
  });
  it("cancels unreturned releases without deleting history", async () => {
    const { item: i, borrow: b } = await loan(5);
    await cancelBorrow(b.id, {
      action: "cancel",
      reason: "Release did not occur",
    });
    const detail = await borrowDetail(b.id);
    expect([
      detail.status,
      detail.quantityOutstanding,
      detail.items[0].quantityCancelled,
    ]).toEqual(["CANCELLED", 0, 5]);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } }))
        .availableQuantity,
    ).toBe(20);
    await expect(
      recordReturn(returned(b.id, b.items[0].id, 1)),
    ).rejects.toThrow("closed");
  });
  it("disallows cancellation after a partial return", async () => {
    const { borrow: b } = await loan();
    await recordReturn(returned(b.id, b.items[0].id, 1));
    await expect(
      cancelBorrow(b.id, { action: "cancel", reason: "Invalid" }),
    ).rejects.toThrow("before any returns");
  });
  it("serializes concurrent borrowing of the same remaining stock", async () => {
    const i = await item(5);
    const results = await Promise.allSettled([
      createBorrow(input([{ id: i.id, quantity: 4 }])),
      createBorrow(input([{ id: i.id, quantity: 4 }])),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } }))
        .availableQuantity,
    ).toBe(1);
  });
  it("deduplicates concurrent borrow and return retries", async () => {
    const i = await item(5),
      raw = input([{ id: i.id, quantity: 3 }]);
    const [a, b] = await Promise.all([createBorrow(raw), createBorrow(raw)]);
    expect(a.id).toBe(b.id);
    const detail = await borrowDetail(a.id);
    const ret = returned(a.id, detail.items[0].id, 2);
    const [first, second] = await Promise.all([
      recordReturn(ret),
      recordReturn(ret),
    ]);
    expect(first.id).toBe(second.id);
    expect((await borrowDetail(a.id)).quantityReturned).toBe(2);
  });
  it("serializes concurrent returns without over-returning", async () => {
    const { borrow: b } = await loan(5);
    const results = await Promise.allSettled([
      recordReturn(returned(b.id, b.items[0].id, 4)),
      recordReturn(returned(b.id, b.items[0].id, 4)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await borrowDetail(b.id)).quantityOutstanding).toBe(1);
  });
  it("protects loan facts, return history and stored borrowed balances", async () => {
    const { item: i, borrow: b } = await loan();
    await expect(
      db.borrowTransactionItem.update({
        where: { id: b.items[0].id },
        data: { quantityBorrowed: 1 },
      }),
    ).rejects.toThrow("immutable");
    await expect(
      db.inventoryItem.update({
        where: { id: i.id },
        data: { borrowedQuantity: 0 },
      }),
    ).rejects.toThrow("Unavailable quantity");
    await expect(
      db.borrowTransaction.update({
        where: { id: b.id },
        data: { status: "RETURNED" },
      }),
    ).rejects.toThrow();
    const ret = await recordReturn(returned(b.id, b.items[0].id, 1));
    await expect(
      db.returnTransaction.delete({ where: { id: ret.id } }),
    ).rejects.toThrow("immutable");
  });
  it("searches borrower IDs and items, validates filters and reads dashboard totals", async () => {
    const page = await listBorrowing(
      new URLSearchParams({
        search: `ID-${prefix}`,
        borrowerType: "STUDENT",
        sort: "expectedReturnDate",
        direction: "asc",
      }),
    );
    expect(page.total).toBeGreaterThan(0);
    expect(
      (await borrowingDashboard()).cards["Currently Borrowed Items"],
    ).toBeGreaterThan(0);
    await expect(
      listBorrowing(new URLSearchParams("dueFrom=2026-02-30")),
    ).rejects.toThrow();
  });
  it("generates all ten borrow and return reports", async () => {
    for (const kind of borrowReportKinds) {
      const report = await generateReport(
        new URLSearchParams({ kind, search: prefix, archived: "all" }),
      );
      expect(report.columns).toContain("Quantity");
      expect(report.title).toContain("Report");
    }
  });
  it("uses borrower-only and return-number searches without applying them to inventory names", async () => {
    const { borrow: b } = await loan(2);
    const uniqueId = `BORROWER-ONLY-${randomUUID()}`;
    // Use a distinct new loan because original borrower facts are deliberately immutable.
    const i = await item(2),
      created = await createBorrow({
        ...input([{ id: i.id, quantity: 2 }]),
        borrowerIdNumber: uniqueId,
      });
    const report = await generateReport(
      new URLSearchParams({
        kind: "borrowing-history",
        search: uniqueId,
        archived: "all",
      }),
    );
    expect(report.rows).toHaveLength(1);
    const detail = await borrowDetail(created.id),
      returnedRecord = await recordReturn(
        returned(created.id, detail.items[0].id, 2),
      );
    const returns = await generateReport(
      new URLSearchParams({
        kind: "return-history",
        search: returnedRecord.returnNumber,
        archived: "all",
      }),
    );
    expect(returns.rows).toHaveLength(1);
    expect(b.id).toBeTruthy();
  });
  it("keeps fully borrowed inventory usable and permits returns after archiving", async () => {
    const i = await item(2),
      created = await createBorrow(input([{ id: i.id, quantity: 2 }]));
    const d = await borrowDetail(created.id);
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } }))
        .condition,
    ).toBe("GOOD");
    await db.inventoryItem.update({
      where: { id: i.id },
      data: { isActive: false },
    });
    await recordReturn(returned(created.id, d.items[0].id, 2));
    expect(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: i.id } }))
        .availableQuantity,
    ).toBe(2);
  });
});
