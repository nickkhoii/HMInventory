import { Prisma } from "@prisma/client";
import { db } from "./db";
import { z } from "zod";
import { dateRange, pageNumber } from "./query-validation";
export async function listTransactions(params: URLSearchParams) {
  let page = pageNumber(params);
  const type = params.get("type"),
    search = params.get("search")?.trim().slice(0, 200),
    itemId = params.get("item");
  const where: Prisma.InventoryTransactionWhereInput = {
    transactionDate: dateRange(params),
    ...(itemId ? { itemId } : {}),
    ...(type
      ? {
          type: z
            .enum([
              "INITIAL",
              "STOCK_IN",
              "STOCK_OUT",
              "ADJUSTMENT",
              "DAMAGE",
              "REPAIR",
              "LOST",
              "RECOVERY",
              "DISPOSAL",
              "BORROW",
              "RETURN",
              "BORROW_CANCEL",
            ])
            .parse(type),
        }
      : {}),
    ...(search
      ? {
          item: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { inventoryCode: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  return db.$transaction(
    async (tx) => {
      const total = await tx.inventoryTransaction.count({ where });
      page = Math.min(page, Math.max(1, Math.ceil(total / 20)));
      const items = await tx.inventoryTransaction.findMany({
        where,
        include: { item: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 20,
        take: 20,
      });
      return { items, total, page };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function listActivity(params: URLSearchParams) {
  let page = pageNumber(params);
  const where: Prisma.ActivityLogWhereInput = { createdAt: dateRange(params) };
  return db.$transaction(
    async (tx) => {
      const total = await tx.activityLog.count({ where });
      page = Math.min(page, Math.max(1, Math.ceil(total / 30)));
      const items = await tx.activityLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 30,
        take: 30,
      });
      return { items, total, page };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
