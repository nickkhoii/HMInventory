import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "./db";
import { AppError } from "./errors";
import { lockItem, transactionNumber } from "./inventory-service";
import { reconcileCondition } from "./condition";
import {
  borrowSchema,
  returnSchema,
  cancelBorrowSchema,
} from "./borrow-validation";
import { outstanding } from "./borrow-rules";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function number(
  tx: Prisma.TransactionClient,
  kind: "borrow" | "return",
  date: string,
) {
  const rows =
    kind === "borrow"
      ? await tx.$queryRaw<
          { n: bigint }[]
        >`SELECT nextval('hm_borrow_number') AS n`
      : await tx.$queryRaw<
          { n: bigint }[]
        >`SELECT nextval('hm_return_number') AS n`;
  return `${kind === "borrow" ? "BRW" : "RTN"}-${date.slice(0, 4)}-${rows[0].n.toString().padStart(4, "0")}`;
}
async function lockBorrow(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "BorrowTransaction" WHERE "id"=${id} FOR UPDATE`;
  const record = await tx.borrowTransaction.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!record) throw new AppError("Borrow transaction not found", 404);
  return record;
}
export async function createBorrow(raw: unknown) {
  const input = borrowSchema.parse(raw),
    requestHash = digest(input);
  return db.$transaction(
    async (tx) => {
      // A global UUID advisory lock also deduplicates requests containing different item sets.
      if (input.requestId) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId},0))::text`;
        const prior = await tx.borrowTransaction.findUnique({
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
      const locked = new Map<string, Awaited<ReturnType<typeof lockItem>>>();
      for (const line of [...input.items].sort((a, b) =>
        a.inventoryItemId.localeCompare(b.inventoryItemId),
      )) {
        const item = await lockItem(tx, line.inventoryItemId);
        if (!item.isActive)
          throw new AppError("Restore inventory before borrowing");
        if (item.availableQuantity < line.quantity)
          throw new AppError(
            `Insufficient available quantity. Only ${item.availableQuantity} item(s) are currently available. (${item.inventoryCode})`,
          );
        locked.set(item.id, item);
      }
      const { items, requestId, ...fields } = input;
      const record = await tx.borrowTransaction.create({
        data: {
          ...fields,
          requestId,
          requestHash: requestId ? requestHash : undefined,
          transactionNumber: await number(tx, "borrow", input.borrowedDate),
          borrowedDate: new Date(input.borrowedDate),
          expectedReturnDate: new Date(input.expectedReturnDate),
          items: {
            create: items.map((line) => {
              const item = locked.get(line.inventoryItemId)!;
              return {
                inventoryItemId: item.id,
                inventoryCode: item.inventoryCode,
                itemName: item.name,
                unit: item.unit,
                quantityBorrowed: line.quantity,
                conditionBeforeRelease: line.conditionBeforeRelease,
                remarks: line.remarks,
              };
            }),
          },
        },
      });
      for (const line of items) {
        const item = locked.get(line.inventoryItemId)!;
        const updated = await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            availableQuantity: { decrement: line.quantity },
            borrowedQuantity: { increment: line.quantity },
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            transactionNumber: transactionNumber(),
            itemId: item.id,
            borrowTransactionId: record.id,
            type: "BORROW",
            quantity: line.quantity,
            previousQuantity: item.quantity,
            newQuantity: item.quantity,
            previousAvailable: item.availableQuantity,
            newAvailable: updated.availableQuantity,
            unitCost: item.unitCost,
            transactionDate: new Date(input.borrowedDate),
            purpose: input.purpose,
            reason: `${record.transactionNumber}: ${input.borrowerName}`,
            remarks: line.remarks,
          },
        });
        await reconcileCondition(
          tx,
          updated,
          `Borrowed under ${record.transactionNumber}`,
        );
        await tx.activityLog.create({
          data: {
            action: "Item Borrowed",
            description: `${record.transactionNumber}: ${item.inventoryCode}, ${line.quantity} ${item.unit}; borrower ${input.borrowerName}`,
          },
        });
      }
      await tx.activityLog.create({
        data: {
          action: "Borrow Transaction Created",
          description: `${record.transactionNumber}: ${input.borrowerName}; ${items.length} inventory lines`,
        },
      });
      return record;
    },
    { timeout: 20000 },
  );
}
export async function recordReturn(raw: unknown) {
  const input = returnSchema.parse(raw),
    requestHash = digest(input);
  return db.$transaction(
    async (tx) => {
      if (input.requestId) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId},0))::text`;
        const prior = await tx.returnTransaction.findUnique({
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
      const borrow = await lockBorrow(tx, input.borrowTransactionId);
      if (["RETURNED", "CANCELLED"].includes(borrow.status))
        throw new AppError("This borrowing transaction is already closed");
      if (input.returnDate < borrow.borrowedDate.toISOString().slice(0, 10))
        throw new AppError("Return date cannot be before borrowing date");
      const quantities = new Map<string, number>();
      for (const line of input.items) {
        const borrowed = borrow.items.find(
          (i) => i.id === line.borrowTransactionItemId,
        );
        if (!borrowed)
          throw new AppError(
            "The item does not belong to this borrowing transaction",
          );
        const total = (quantities.get(borrowed.id) ?? 0) + line.quantity;
        if (total > outstanding(borrowed))
          throw new AppError(
            `Return quantity cannot exceed outstanding quantity. Only ${outstanding(borrowed)} item(s) remain. (${borrowed.inventoryCode})`,
          );
        quantities.set(borrowed.id, total);
      }
      const inventoryIds = [
        ...new Set(
          borrow.items
            .filter((i) => quantities.has(i.id))
            .map((i) => i.inventoryItemId),
        ),
      ].sort();
      const locked = new Map<string, Awaited<ReturnType<typeof lockItem>>>();
      for (const id of inventoryIds) locked.set(id, await lockItem(tx, id));
      const returned = await tx.returnTransaction.create({
        data: {
          requestId: input.requestId,
          requestHash: input.requestId ? requestHash : undefined,
          returnNumber: await number(tx, "return", input.returnDate),
          borrowTransactionId: borrow.id,
          returnDate: new Date(input.returnDate),
          remarks: input.remarks,
        },
      });
      for (const line of input.items) {
        const borrowed = borrow.items.find(
          (i) => i.id === line.borrowTransactionItemId,
        )!;
        const item = locked.get(borrowed.inventoryItemId)!;
        const usable = ["GOOD", "FAIR"].includes(line.returnCondition);
        const detail = await tx.returnTransactionItem.create({
          data: {
            returnTransactionId: returned.id,
            borrowTransactionItemId: borrowed.id,
            quantityReturned: line.quantity,
            returnCondition: line.returnCondition,
            damageDescription: line.damageDescription,
            actionRequired: line.actionRequired,
            remarks: line.remarks,
          },
        });
        await tx.borrowTransactionItem.update({
          where: { id: borrowed.id },
          data: { quantityReturned: { increment: line.quantity } },
        });
        if (line.returnCondition === "DAMAGED") {
          await tx.damageRecord.create({
            data: {
              itemId: item.id,
              returnItemId: detail.id,
              quantity: line.quantity,
              dateReported: new Date(input.returnDate),
              description: line.damageDescription,
              actionTaken: line.actionRequired,
            },
          });
          await tx.activityLog.create({
            data: {
              action: "Damaged Return Recorded",
              description: `${borrow.transactionNumber}: ${borrow.borrowerName}; ${item.inventoryCode}, ${line.quantity}. ${line.damageDescription}`,
            },
          });
        }
        if (line.returnCondition === "LOST_MISSING") {
          await tx.lostItemRecord.create({
            data: {
              itemId: item.id,
              returnItemId: detail.id,
              quantity: line.quantity,
              dateReported: new Date(input.returnDate),
              description: line.damageDescription,
              remarks: line.remarks,
            },
          });
          await tx.activityLog.create({
            data: {
              action: "Lost Item Recorded",
              description: `${borrow.transactionNumber}: ${borrow.borrowerName}; ${item.inventoryCode}, ${line.quantity}. ${line.damageDescription}`,
            },
          });
        }
        const updated = await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            borrowedQuantity: { decrement: line.quantity },
            availableQuantity: { increment: usable ? line.quantity : 0 },
            ...(usable && line.returnCondition === "FAIR"
              ? { condition: "FAIR" as const }
              : {}),
          },
        });
        if (updated.condition !== item.condition)
          await tx.conditionHistory.create({
            data: {
              itemId: item.id,
              previous: item.condition,
              current: updated.condition,
              reason: `Fair-condition return under ${returned.returnNumber}`,
            },
          });
        await reconcileCondition(
          tx,
          updated,
          `${line.returnCondition} return under ${returned.returnNumber}`,
        );
        await tx.inventoryTransaction.create({
          data: {
            transactionNumber: transactionNumber(),
            itemId: item.id,
            borrowTransactionId: borrow.id,
            returnTransactionId: returned.id,
            type: "RETURN",
            quantity: line.quantity,
            previousQuantity: item.quantity,
            newQuantity: item.quantity,
            previousAvailable: item.availableQuantity,
            newAvailable: updated.availableQuantity,
            unitCost: item.unitCost,
            transactionDate: new Date(input.returnDate),
            reason: `${returned.returnNumber}: ${line.returnCondition}; ${borrow.borrowerName}`,
            remarks: line.remarks,
          },
        });
        locked.set(
          item.id,
          await tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } }),
        );
      }
      const lines = await tx.borrowTransactionItem.findMany({
        where: { borrowTransactionId: borrow.id },
      });
      const complete = lines.every((i) => outstanding(i) === 0);
      const latest = complete
        ? await tx.returnTransaction.aggregate({
            where: { borrowTransactionId: borrow.id },
            _max: { returnDate: true },
          })
        : undefined;
      await tx.borrowTransaction.update({
        where: { id: borrow.id },
        data: {
          status: complete ? "RETURNED" : "PARTIALLY_RETURNED",
          finalReturnDate: latest?._max.returnDate ?? null,
        },
      });
      await tx.activityLog.create({
        data: {
          action: complete ? "Full Return Recorded" : "Partial Return Recorded",
          description: `${borrow.transactionNumber}: ${borrow.borrowerName}; ${returned.returnNumber}, ${input.items.reduce((n, i) => n + i.quantity, 0)} units`,
        },
      });
      return returned;
    },
    { timeout: 20000 },
  );
}
export async function cancelBorrow(id: string, raw: unknown) {
  const input = cancelBorrowSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const borrow = await lockBorrow(tx, id);
      if (borrow.status === "CANCELLED") return borrow;
      if (borrow.items.some((i) => i.quantityReturned > 0))
        throw new AppError(
          "Borrowing can only be cancelled before any returns are recorded",
        );
      for (const line of [...borrow.items].sort((a, b) =>
        a.inventoryItemId.localeCompare(b.inventoryItemId),
      )) {
        const item = await lockItem(tx, line.inventoryItemId),
          n = outstanding(line);
        const updated = await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            availableQuantity: { increment: n },
            borrowedQuantity: { decrement: n },
          },
        });
        await tx.borrowTransactionItem.update({
          where: { id: line.id },
          data: { quantityCancelled: n },
        });
        await reconcileCondition(
          tx,
          updated,
          `Cancellation of ${borrow.transactionNumber}`,
        );
        await tx.inventoryTransaction.create({
          data: {
            transactionNumber: transactionNumber(),
            itemId: item.id,
            borrowTransactionId: borrow.id,
            type: "BORROW_CANCEL",
            quantity: n,
            previousQuantity: item.quantity,
            newQuantity: item.quantity,
            previousAvailable: item.availableQuantity,
            newAvailable: updated.availableQuantity,
            unitCost: item.unitCost,
            transactionDate: new Date(),
            reason: input.reason,
          },
        });
      }
      const updated = await tx.borrowTransaction.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: input.reason,
        },
      });
      await tx.activityLog.create({
        data: {
          action: "Borrow Transaction Cancelled",
          description: `${borrow.transactionNumber}: ${input.reason}`,
        },
      });
      return updated;
    },
    { timeout: 20000 },
  );
}
