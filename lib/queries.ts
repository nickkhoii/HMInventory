import { Prisma } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./errors";
import { conditions } from "./validation";
import { decimalTotal } from "./money";
import { borrowingDashboard } from "./borrow-queries";
import { laboratoryToday } from "./borrow-rules";
import { z } from "zod";
import { pageNumber, dateRange, archiveFilter } from "./query-validation";
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function inventoryWhere(
  params: URLSearchParams,
): Prisma.InventoryItemWhereInput {
  const archived = archiveFilter(params);
  const where: Prisma.InventoryItemWhereInput =
    archived === "all" ? {} : { isActive: archived !== "true" };
  const search = params.get("search")?.trim().slice(0, 200);
  if (search)
    where.OR = [
      "inventoryCode",
      "name",
      "brand",
      "model",
      "serialNumber",
      "supplier",
    ].map((key) => ({ [key]: { contains: search, mode: "insensitive" } }));
  if (params.get("category")) where.categoryId = params.get("category")!;
  if (params.get("location")) where.locationId = params.get("location")!;
  const condition = params.get("condition");
  if (condition) {
    if (!conditions.includes(condition as (typeof conditions)[number]))
      throw new AppError("Invalid condition filter");
    where.condition = condition as (typeof conditions)[number];
  }
  const stock = params.get("stock");
  if (stock)
    z.enum(["OUT_OF_STOCK", "LOW_STOCK", "AVAILABLE", "ATTENTION"]).parse(
      stock,
    );
  if (stock === "ATTENTION")
    where.availableQuantity = { lte: db.inventoryItem.fields.minimumStock };
  if (stock === "OUT_OF_STOCK") where.availableQuantity = 0;
  if (params.get("stock") === "LOW_STOCK")
    where.AND = [
      { availableQuantity: { gt: 0 } },
      { availableQuantity: { lte: db.inventoryItem.fields.minimumStock } },
    ];
  if (params.get("stock") === "AVAILABLE")
    where.availableQuantity = { gt: db.inventoryItem.fields.minimumStock };
  const from = params.get("from"),
    to = params.get("to");
  if (from || to) {
    where.dateAcquired = dateRange(params);
  }
  return where;
}
export async function listInventory(params: URLSearchParams) {
  let page = pageNumber(params);
  const sort = params.get("sort") || "updatedAt";
  const allowed = [
    "name",
    "quantity",
    "dateAcquired",
    "unitCost",
    "updatedAt",
    "totalValue",
  ];
  if (!allowed.includes(sort)) throw new AppError("Invalid sort");
  const where = inventoryWhere(params);
  return db.$transaction(
    async (tx) => {
      const total = await tx.inventoryItem.count({ where });
      page = Math.min(page, Math.max(1, Math.ceil(total / 20)));
      const items = await tx.inventoryItem.findMany({
        where,
        include: { category: true, location: true },
        orderBy: [{ [sort]: sort === "name" ? "asc" : "desc" }, { id: "asc" }],
        skip: (page - 1) * 20,
        take: 20,
      });
      return { items, total, page };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function dashboard() {
  const borrowing = await borrowingDashboard();
  const [items, categories, transactions, damages, losses, disposals] =
    await Promise.all([
      db.inventoryItem.findMany({
        where: { isActive: true },
        include: { category: true },
      }),
      db.category.count({ where: { isActive: true } }),
      db.inventoryTransaction.findMany({
        include: { item: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.damageRecord.aggregate({
        where: { status: { notIn: ["REPAIRED", "DISPOSED"] } },
        _sum: { quantity: true },
      }),
      db.lostItemRecord.aggregate({
        where: { status: { not: "RECOVERED" } },
        _sum: { quantity: true },
      }),
      db.disposalRecord.aggregate({ _sum: { quantity: true } }),
    ]);
  const low = items.filter((i) => i.availableQuantity <= i.minimumStock);
  const byCategory: Record<string, number> = Object.create(null),
    byCondition: Record<string, number> = Object.create(null);
  for (const item of items) {
    byCategory[item.category.name] =
      (byCategory[item.category.name] || 0) + item.quantity;
    byCondition[label(item.condition)] =
      (byCondition[label(item.condition)] || 0) + item.quantity;
  }
  const since = new Date(laboratoryToday());
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);
  const movements = await db.inventoryTransaction.findMany({
    where: {
      transactionDate: { gte: since },
      type: { in: ["STOCK_IN", "STOCK_OUT"] },
    },
    orderBy: { transactionDate: "asc" },
  });
  const days = new Map<string, { name: string; in: number; out: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.set(key, { name: key.slice(5), in: 0, out: 0 });
  }
  for (const t of movements) {
    const day = days.get(t.transactionDate.toISOString().slice(0, 10));
    if (day) day[t.type === "STOCK_IN" ? "in" : "out"] += t.quantity;
  }
  return {
    cards: {
      ...borrowing.cards,
      "Inventory items": items.length,
      "Total quantity": items.reduce((s, i) => s + i.quantity, 0),
      "Available units": items.reduce((s, i) => s + i.availableQuantity, 0),
      "Low stock items": low.filter((i) => i.availableQuantity > 0).length,
      "Out of stock": low.filter((i) => i.availableQuantity === 0).length,
      "Damaged units": damages._sum.quantity ?? 0,
      "Missing units": losses._sum.quantity ?? 0,
      "Disposed units": disposals._sum.quantity ?? 0,
      Categories: categories,
    },
    low,
    transactions: transactions.slice(0, 8),
    byCategory: Object.entries(byCategory).map(([name, value]) => ({
      name,
      value,
    })),
    byCondition: Object.entries(byCondition).map(([name, value]) => ({
      name,
      value,
    })),
    movements: [...days.values()],
    valuation: decimalTotal(items.map((i) => i.totalValue)),
    dueBorrowing: borrowing.due,
  };
}
