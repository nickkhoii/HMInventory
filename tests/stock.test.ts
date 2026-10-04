import { describe, it, expect } from "vitest";
import { calculateMovement, stockLevel } from "../lib/stock";
import { itemSchema, operationSchema } from "../lib/validation";
describe("inventory accounting", () => {
  const base = { quantity: 20, availableQuantity: 17 };
  it.each([
    ["STOCK_IN", 5, 25, 22],
    ["STOCK_OUT", 3, 17, 14],
    ["ADD", 4, 24, 21],
    ["DEDUCT", 2, 18, 15],
    ["DAMAGE", 2, 20, 15],
    ["LOST", 3, 20, 14],
    ["REPAIR", 2, 20, 19],
    ["RECOVERY", 3, 20, 20],
    ["DISPOSAL", 2, 18, 15],
    ["RETURNED", 1, 21, 18],
    ["OTHER", 1, 21, 18],
    ["PHYSICAL_COUNT", 10, 13, 10],
    ["PHYSICAL_COUNT", 0, 3, 0],
  ] as const)(
    "%s preserves expected held and available balances",
    (type, quantity, held, available) => {
      expect(calculateMovement(base, { type, quantity })).toEqual({
        quantity: held,
        availableQuantity: available,
      });
    },
  );
  it.each(["STOCK_OUT", "DAMAGE", "LOST", "DISPOSAL", "DEDUCT"] as const)(
    "rejects overspending for %s",
    (type) =>
      expect(() => calculateMovement(base, { type, quantity: 18 })).toThrow(
        "exceeds available",
      ),
  );
  it("rejects excess recovery", () =>
    expect(() =>
      calculateMovement(base, { type: "RECOVERY", quantity: 4 }),
    ).toThrow());
  it.each([-1, 1.5, NaN, Infinity, 0])(
    "rejects invalid quantity %s",
    (quantity) =>
      expect(() =>
        calculateMovement(base, { type: "STOCK_IN", quantity }),
      ).toThrow(),
  );
  it("marks zero stock before minimum threshold", () =>
    expect(stockLevel(0, 0)).toBe("OUT_OF_STOCK"));
  it("marks stock at or below the minimum", () => {
    expect(stockLevel(3, 5)).toBe("LOW_STOCK");
    expect(stockLevel(5, 5)).toBe("LOW_STOCK");
    expect(stockLevel(6, 5)).toBe("AVAILABLE");
  });
});
describe("server validation", () => {
  const movement = {
    itemId: "test",
    date: "2026-10-04",
    type: "STOCK_OUT",
    quantity: 1,
    purpose: "Laboratory class",
  };
  it("accepts valid stock-out", () =>
    expect(operationSchema.safeParse(movement).success).toBe(true));
  it("requires stock-out purpose", () =>
    expect(
      operationSchema.safeParse({ ...movement, purpose: "" }).success,
    ).toBe(false));
  it("requires adjustment reason", () =>
    expect(
      operationSchema.safeParse({ ...movement, type: "ADD" }).success,
    ).toBe(false));
  it("requires linked resolution records", () =>
    expect(
      operationSchema.safeParse({
        ...movement,
        type: "RECOVERY",
        reason: "Found",
      }).success,
    ).toBe(false));
  it("requires disposal method", () =>
    expect(
      operationSchema.safeParse({
        ...movement,
        type: "DISPOSAL",
        reason: "Broken",
      }).success,
    ).toBe(false));
  it("rejects impossible dates", () =>
    expect(
      operationSchema.safeParse({ ...movement, date: "2026-02-31" }).success,
    ).toBe(false));
  const item = {
    inventoryCode: "HM-0001",
    name: "Mixer",
    categoryId: "c",
    locationId: "l",
    unit: "piece",
    quantity: 1,
    minimumStock: 1,
    unitCost: 100,
    dateAcquired: "2026-10-04",
    condition: "GOOD",
  };
  it("validates new items", () =>
    expect(itemSchema.safeParse(item).success).toBe(true));
  it.each([
    { quantity: -1 },
    { quantity: 0.5 },
    { unitCost: -1 },
    { unitCost: 1.001 },
    { inventoryCode: "" },
    { name: "" },
  ])("rejects invalid item data %s", (change) =>
    expect(itemSchema.safeParse({ ...item, ...change }).success).toBe(false),
  );
});
