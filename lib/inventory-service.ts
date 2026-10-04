import { Prisma, TransactionType } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { db } from "./db";
import { AppError } from "./errors";
import { calculateMovement } from "./stock";
import { itemSchema, operationSchema } from "./validation";
import { reconcileCondition } from "./condition";
export const transactionNumber = () =>
  `HM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()}`;
type Tx = Prisma.TransactionClient;
export async function lockItem(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id"=${id} FOR UPDATE`;
  const item = await tx.inventoryItem.findUnique({ where: { id } });
  if (!item) throw new AppError("Item not found", 404);
  return item;
}
async function validateLookups(
  tx: Tx,
  categoryId: string,
  locationId: string,
  old?: { categoryId: string; locationId: string },
) {
  await tx.$queryRaw`SELECT "id" FROM "Category" WHERE "id"=${categoryId} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "Location" WHERE "id"=${locationId} FOR SHARE`;
  const category = await tx.category.findUnique({ where: { id: categoryId } });
  const location = await tx.location.findUnique({ where: { id: locationId } });
  if (!category || (!category.isActive && old?.categoryId !== categoryId))
    throw new AppError("Select an active category");
  if (!location || (!location.isActive && old?.locationId !== locationId))
    throw new AppError("Select an active location");
}
export async function saveItem(raw: unknown, id?: string) {
  const input = itemSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const old = id ? await lockItem(tx, id) : undefined;
    await validateLookups(tx, input.categoryId, input.locationId, old);
    if (old && input.quantity !== old.quantity)
      throw new AppError("Use stock operations to change quantity");
    if (
      old &&
      input.expectedUpdatedAt &&
      old.updatedAt.toISOString() !== input.expectedUpdatedAt
    )
      throw new AppError(
        "This item changed since the form was opened. Reload it before saving",
        409,
      );
    if (
      old &&
      input.condition !== old.condition &&
      (!["NEW", "GOOD", "FAIR"].includes(input.condition) ||
        (old.availableQuantity === 0 && old.quantity > 0))
    )
      throw new AppError(
        "Use damage, repair, loss, recovery or disposal records to change unavailable inventory conditions",
      );
    if (!old && !["NEW", "GOOD", "FAIR"].includes(input.condition))
      throw new AppError(
        "Create usable inventory first, then record damage, loss or disposal",
      );
    const { quantity, expectedUpdatedAt: _revision, ...fields } = input;
    void _revision;
    const data = { ...fields, dateAcquired: new Date(input.dateAcquired) };
    const item = old
      ? await tx.inventoryItem.update({ where: { id }, data })
      : await tx.inventoryItem.create({
          data: { ...data, quantity, availableQuantity: quantity },
        });
    if (!old || old.condition !== item.condition)
      await tx.conditionHistory.create({
        data: {
          itemId: item.id,
          previous: old?.condition,
          current: item.condition,
          reason: old ? "Administrator updated condition" : "Initial condition",
        },
      });
    if (!old)
      await tx.inventoryTransaction.create({
        data: {
          transactionNumber: transactionNumber(),
          itemId: item.id,
          type: "INITIAL",
          quantity,
          previousQuantity: 0,
          newQuantity: quantity,
          previousAvailable: 0,
          newAvailable: quantity,
          unitCost: input.unitCost,
          transactionDate: new Date(input.dateAcquired),
          remarks: "Initial inventory",
        },
      });
    await tx.activityLog.create({
      data: {
        action: old ? "Edited Item" : "Added Item",
        description: `${item.inventoryCode}: ${item.name}`,
      },
    });
    return item;
  });
}
export async function archiveItem(id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    const item = await lockItem(tx, id);
    const updated = await tx.inventoryItem.update({
      where: { id },
      data: { isActive },
    });
    await tx.activityLog.create({
      data: {
        action: isActive ? "Restored Item" : "Archived Item",
        description: `${item.inventoryCode}: ${item.name}`,
      },
    });
    return updated;
  });
}
export async function recordMovement(raw: unknown) {
  const input = operationSchema.parse(raw);
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return db.$transaction(async (tx) => {
    if (input.requestId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId},0))::text`;
      const prior = await tx.inventoryTransaction.findUnique({
        where: { requestId: input.requestId },
      });
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new AppError(
            "This request was already submitted with different values",
            409,
          );
        return prior;
      }
    }
    const item = await lockItem(tx, input.itemId);
    if (!item.isActive)
      throw new AppError("Restore the item before recording movements");
    let next =
      input.type === "DISPOSAL" && input.recordId
        ? {
            quantity: item.quantity - input.quantity,
            availableQuantity: item.availableQuantity,
          }
        : calculateMovement(item, input);
    // Resolution always consumes an existing complete record, exactly once.
    if (
      input.type === "REPAIR" ||
      (input.type === "DISPOSAL" && input.recordId)
    ) {
      const record = await tx.damageRecord.findUnique({
        where: { id: input.recordId },
      });
      if (
        !record ||
        record.itemId !== item.id ||
        ["REPAIRED", "DISPOSED"].includes(record.status)
      )
        throw new AppError("Damage record is already resolved or invalid");
      if (input.quantity !== record.quantity)
        throw new AppError("Resolve the full recorded damaged quantity");
      if (input.type === "REPAIR" && record.status === "BEYOND_REPAIR")
        throw new AppError(
          "Reassess the record before repairing an item declared beyond repair",
        );
      if (input.type === "DISPOSAL")
        next = {
          quantity: item.quantity - input.quantity,
          availableQuantity: item.availableQuantity,
        };
      await tx.damageRecord.update({
        where: { id: record.id },
        data: {
          status: input.type === "REPAIR" ? "REPAIRED" : "DISPOSED",
          actionTaken: input.reason,
        },
      });
    }
    if (input.type === "RECOVERY") {
      const record = await tx.lostItemRecord.findUnique({
        where: { id: input.recordId },
      });
      if (!record || record.itemId !== item.id || record.status === "RECOVERED")
        throw new AppError("Lost record is already recovered or invalid");
      if (input.quantity !== record.quantity)
        throw new AppError("Recover the full recorded missing quantity");
      await tx.lostItemRecord.update({
        where: { id: record.id },
        data: { status: "RECOVERED", remarks: input.reason },
      });
    }
    if (next.quantity < 0 || next.availableQuantity > next.quantity)
      throw new AppError("Invalid resulting inventory balance");
    const date = new Date(input.date);
    if (input.type === "DAMAGE")
      await tx.damageRecord.create({
        data: {
          itemId: item.id,
          quantity: input.quantity,
          dateReported: date,
          description: input.reason,
          actionTaken: input.remarks,
        },
      });
    if (input.type === "LOST")
      await tx.lostItemRecord.create({
        data: {
          itemId: item.id,
          quantity: input.quantity,
          dateReported: date,
          description: input.reason,
          remarks: input.remarks,
        },
      });
    if (input.type === "DISPOSAL")
      await tx.disposalRecord.create({
        data: {
          itemId: item.id,
          quantity: input.quantity,
          reason: input.reason,
          disposalDate: date,
          method: input.method,
          remarks: input.remarks,
        },
      });
    const type: TransactionType = [
      "STOCK_IN",
      "STOCK_OUT",
      "DAMAGE",
      "LOST",
      "RECOVERY",
      "REPAIR",
      "DISPOSAL",
    ].includes(input.type)
      ? (input.type as TransactionType)
      : "ADJUSTMENT";
    const transaction = await tx.inventoryTransaction.create({
      data: {
        requestId: input.requestId,
        requestHash: input.requestId ? requestHash : undefined,
        transactionNumber: transactionNumber(),
        itemId: item.id,
        type,
        quantity: input.quantity,
        previousQuantity: item.quantity,
        newQuantity: next.quantity,
        previousAvailable: item.availableQuantity,
        newAvailable: next.availableQuantity,
        unitCost: input.unitCost ?? item.unitCost,
        transactionDate: date,
        supplier: input.supplier,
        referenceNumber: input.referenceNumber,
        purpose: input.purpose,
        reason: `${input.type}: ${input.reason}`,
        remarks: input.remarks,
      },
    });
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        ...next,
        ...(input.type === "STOCK_IN"
          ? {
              unitCost: input.unitCost ?? item.unitCost,
              supplier: input.supplier || item.supplier,
            }
          : {}),
      },
    });
    await reconcileCondition(
      tx,
      { ...item, ...next },
      input.reason,
      input.type === "DISPOSAL",
    );
    await tx.activityLog.create({
      data: {
        action: type,
        description: `${item.inventoryCode}: ${input.quantity} (${item.availableQuantity} → ${next.availableQuantity} available). ${input.reason}`,
      },
    });
    return transaction;
  });
}
