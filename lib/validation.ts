import { z } from "zod";
export const conditions = [
  "NEW",
  "GOOD",
  "FAIR",
  "DAMAGED",
  "FOR_REPAIR",
  "LOST_MISSING",
  "DISPOSED",
] as const;
export const operationTypes = [
  "STOCK_IN",
  "STOCK_OUT",
  "ADD",
  "DEDUCT",
  "PHYSICAL_COUNT",
  "DAMAGE",
  "LOST",
  "RECOVERY",
  "REPAIR",
  "DISPOSAL",
  "RETURNED",
  "OTHER",
] as const;
const text = z.string().trim().max(2000).default("");
const numericInput = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number());
const count = numericInput.pipe(z.number().int().min(0).max(100000000));
const cost = numericInput.pipe(
  z
    .number()
    .min(0)
    .max(99999999999.99)
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001,
      "Use at most two decimal places",
    ),
);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const itemSchema = z.object({
  inventoryCode: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: text,
  categoryId: z.string().min(1).max(100),
  locationId: z.string().min(1).max(100),
  brand: text,
  model: text,
  serialNumber: text,
  unit: z.string().trim().min(1).max(40),
  quantity: count,
  minimumStock: count,
  unitCost: cost,
  dateAcquired: dateSchema,
  supplier: text,
  condition: z.enum(conditions),
  notes: text,
  expectedUpdatedAt: z.string().datetime().optional(),
});
export const lookupSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: text,
});
export const operationSchema = z
  .object({
    itemId: z.string().min(1).max(100),
    requestId: z.string().uuid().optional(),
    type: z.enum(operationTypes),
    quantity: count,
    unitCost: cost.optional(),
    date: dateSchema,
    reason: text,
    remarks: text,
    supplier: text,
    referenceNumber: text,
    purpose: text,
    method: text,
    recordId: z.string().min(1).max(100).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.recordId && !["REPAIR", "RECOVERY", "DISPOSAL"].includes(v.type))
      ctx.addIssue({
        code: "custom",
        path: ["recordId"],
        message: "This operation does not resolve an incident record",
      });
    if (v.type === "STOCK_IN" && v.unitCost === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["unitCost"],
        message: "Unit cost is required for stock-in",
      });
    if (v.type !== "PHYSICAL_COUNT" && v.quantity < 1)
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity must be positive",
      });
    if (!["STOCK_IN", "STOCK_OUT"].includes(v.type) && !v.reason)
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Reason is required",
      });
    if (v.type === "STOCK_OUT" && !v.purpose)
      ctx.addIssue({
        code: "custom",
        path: ["purpose"],
        message: "Purpose is required",
      });
    if (v.type === "DISPOSAL" && !v.method)
      ctx.addIssue({
        code: "custom",
        path: ["method"],
        message: "Disposal method is required",
      });
    if (["REPAIR", "RECOVERY"].includes(v.type) && !v.recordId)
      ctx.addIssue({
        code: "custom",
        path: ["recordId"],
        message: "Select a record to resolve",
      });
  });
export type Operation = z.infer<typeof operationSchema>;
const passwordInput = z
  .string()
  .min(1)
  .max(128)
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Password must not exceed 72 UTF-8 bytes",
  );
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: passwordInput,
  remember: z.boolean().default(false),
});
export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  username: z.string().trim().min(3).max(80),
  institutionName: z.string().trim().min(1).max(200),
  laboratoryName: z.string().trim().min(1).max(200),
  reportHeader: z.string().trim().min(1).max(300),
  currentPassword: passwordInput,
  newPassword: z
    .string()
    .max(128)
    .default("")
    .refine(
      (v) => !v || v.length >= 12,
      "New password must have at least 12 characters",
    )
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      "Password must not exceed 72 UTF-8 bytes",
    ),
});
