import { z } from "zod";
import { dateSchema } from "./validation";
import {
  borrowerTypes,
  returnConditions,
  laboratoryToday,
} from "./borrow-rules";
const text = z.string().trim().max(2000).default("");
const id = z.string().min(1).max(100);
const positive = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number<string | number>().int().min(1).max(100000000));
export const borrowSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    borrowerName: z.string().trim().min(1).max(160),
    borrowerType: z.enum(borrowerTypes),
    borrowerIdNumber: z.string().trim().max(100).default(""),
    department: z.string().trim().max(200).default(""),
    program: z.string().trim().max(200).default(""),
    yearSection: z.string().trim().max(100).default(""),
    contactNumber: z.string().trim().max(80).default(""),
    purpose: z.string().trim().min(1).max(2000),
    borrowedDate: dateSchema,
    expectedReturnDate: dateSchema,
    remarks: text,
    items: z
      .array(
        z.object({
          inventoryItemId: id,
          quantity: positive,
          conditionBeforeRelease: z.enum(["NEW", "GOOD", "FAIR"]),
          remarks: text,
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((v, ctx) => {
    if (v.expectedReturnDate < v.borrowedDate)
      ctx.addIssue({
        code: "custom",
        path: ["expectedReturnDate"],
        message: "Expected return date cannot be before borrowing date",
      });
    if (v.borrowedDate > laboratoryToday())
      ctx.addIssue({
        code: "custom",
        path: ["borrowedDate"],
        message: "Date borrowed cannot be in the future",
      });
    if (new Set(v.items.map((i) => i.inventoryItemId)).size !== v.items.length)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Include each inventory item once",
      });
  });
export const returnSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    borrowTransactionId: id,
    returnDate: dateSchema,
    remarks: text,
    items: z
      .array(
        z.object({
          borrowTransactionItemId: id,
          quantity: positive,
          returnCondition: z.enum(returnConditions),
          damageDescription: text,
          actionRequired: text,
          remarks: text,
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((v, ctx) => {
    if (v.returnDate > laboratoryToday())
      ctx.addIssue({
        code: "custom",
        path: ["returnDate"],
        message: "Return date cannot be in the future",
      });
    for (const [i, item] of v.items.entries())
      if (
        ["DAMAGED", "LOST_MISSING"].includes(item.returnCondition) &&
        !item.damageDescription
      )
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "damageDescription"],
          message: "Describe the damage or loss",
        });
    const keys = v.items.map(
      (i) => `${i.borrowTransactionItemId}:${i.returnCondition}`,
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Combine quantities for the same item and return condition",
      });
  });
export const cancelBorrowSchema = z.object({
  action: z.literal("cancel"),
  reason: z.string().trim().min(1).max(2000),
});
