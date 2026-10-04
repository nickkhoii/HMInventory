import { describe, it, expect } from "vitest";
import { borrowSchema, returnSchema } from "../lib/borrow-validation";
import {
  borrowState,
  daysOverdue,
  laboratoryToday,
  outstanding,
} from "../lib/borrow-rules";
const base = {
  borrowerName: "Juan Dela Cruz",
  borrowerType: "STUDENT",
  purpose: "Laboratory activity",
  borrowedDate: "2026-01-01",
  expectedReturnDate: "2026-01-02",
  items: [
    { inventoryItemId: "item", quantity: 2, conditionBeforeRelease: "GOOD" },
  ],
};
describe("borrow and return rules", () => {
  it("requires a borrower and at least one positive inventory line", () => {
    expect(borrowSchema.safeParse(base).success).toBe(true);
    expect(borrowSchema.safeParse({ ...base, borrowerName: "" }).success).toBe(
      false,
    );
    expect(borrowSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
  it.each([0, -1, 1.5, null, true, "", " "])(
    "rejects borrowing quantity %j",
    (quantity) =>
      expect(
        borrowSchema.safeParse({
          ...base,
          items: [{ ...base.items[0], quantity }],
        }).success,
      ).toBe(false),
  );
  it("rejects duplicate inventory lines and expected dates before release", () => {
    expect(
      borrowSchema.safeParse({ ...base, items: [...base.items, ...base.items] })
        .success,
    ).toBe(false);
    expect(
      borrowSchema.safeParse({ ...base, expectedReturnDate: "2025-12-31" })
        .success,
    ).toBe(false);
  });
  it("uses Manila midnight for due and overdue calculations", () => {
    expect(laboratoryToday(new Date("2026-10-04T16:00:00Z"))).toBe(
      "2026-10-05",
    );
    expect(daysOverdue("2026-10-03", "2026-10-05")).toBe(2);
    expect(daysOverdue("2026-10-06", "2026-10-05")).toBe(0);
  });
  it.each([
    ["BORROWED", 0, "2026-10-05", "BORROWED"],
    ["PARTIALLY_RETURNED", 6, "2026-10-05", "PARTIALLY_RETURNED"],
    ["PARTIALLY_RETURNED", 10, "2026-10-03", "RETURNED"],
    ["BORROWED", 0, "2026-10-03", "OVERDUE"],
    ["PARTIALLY_RETURNED", 6, "2026-10-03", "OVERDUE"],
    ["CANCELLED", 0, "2026-10-03", "CANCELLED"],
  ])(
    "calculates %s with %i returned",
    (status, quantityReturned, expectedReturnDate, expected) => {
      expect(
        borrowState(
          {
            status: String(status),
            expectedReturnDate: String(expectedReturnDate),
            items: [
              {
                quantityBorrowed: 10,
                quantityReturned: Number(quantityReturned),
              },
            ],
          },
          "2026-10-04",
        ),
      ).toBe(expected);
    },
  );
  it("removes cancelled quantities from outstanding", () =>
    expect(
      outstanding({
        quantityBorrowed: 10,
        quantityReturned: 0,
        quantityCancelled: 10,
      }),
    ).toBe(0));
  it("requires descriptions for damaged and lost dispositions", () => {
    for (const returnCondition of ["DAMAGED", "LOST_MISSING"]) {
      const input = {
        borrowTransactionId: "loan",
        returnDate: "2026-01-02",
        items: [
          { borrowTransactionItemId: "line", quantity: 1, returnCondition },
        ],
      };
      expect(returnSchema.safeParse(input).success).toBe(false);
      expect(
        returnSchema.safeParse({
          ...input,
          items: [
            { ...input.items[0], damageDescription: "Reported incident" },
          ],
        }).success,
      ).toBe(true);
    }
  });
  it("allows one item to be split across usable and damaged conditions", () =>
    expect(
      returnSchema.safeParse({
        borrowTransactionId: "loan",
        returnDate: "2026-01-02",
        items: [
          {
            borrowTransactionItemId: "line",
            quantity: 4,
            returnCondition: "GOOD",
          },
          {
            borrowTransactionItemId: "line",
            quantity: 1,
            returnCondition: "DAMAGED",
            damageDescription: "Chipped",
          },
        ],
      }).success,
    ).toBe(true));
});
