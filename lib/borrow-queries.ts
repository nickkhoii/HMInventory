import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { pageNumber, dateRange } from "./query-validation";
import {
  borrowerTypes,
  borrowStatuses,
  borrowState,
  daysOverdue,
  laboratoryToday,
  outstanding,
} from "./borrow-rules";
import { AppError } from "./errors";
export const activeBorrowStatuses = ["BORROWED", "PARTIALLY_RETURNED"] as const;
export function borrowingWhere(
  params: URLSearchParams,
): Prisma.BorrowTransactionWhereInput {
  const clauses: Prisma.BorrowTransactionWhereInput[] = [];
  const search = params.get("search")?.trim().slice(0, 200);
  if (search)
    clauses.push({
      OR: [
        { transactionNumber: { contains: search, mode: "insensitive" } },
        { borrowerName: { contains: search, mode: "insensitive" } },
        { borrowerIdNumber: { contains: search, mode: "insensitive" } },
        {
          items: {
            some: {
              OR: [
                { itemName: { contains: search, mode: "insensitive" } },
                { inventoryCode: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  if (params.get("borrowerType"))
    clauses.push({
      borrowerType: z.enum(borrowerTypes).parse(params.get("borrowerType")),
    });
  if (params.get("from") || params.get("to"))
    clauses.push({ borrowedDate: dateRange(params) });
  if (params.get("dueFrom") || params.get("dueTo"))
    clauses.push({
      expectedReturnDate: dateRange(
        new URLSearchParams({
          from: params.get("dueFrom") ?? "",
          to: params.get("dueTo") ?? "",
        }),
      ),
    });
  const status = params.get("status");
  if (status) {
    const parsed = z.enum(borrowStatuses).parse(status),
      today = new Date(laboratoryToday());
    if (parsed === "OVERDUE")
      clauses.push({
        status: { in: [...activeBorrowStatuses] },
        expectedReturnDate: { lt: today },
      });
    else if (parsed === "BORROWED" || parsed === "PARTIALLY_RETURNED")
      clauses.push({ status: parsed, expectedReturnDate: { gte: today } });
    else clauses.push({ status: parsed });
  }
  if (params.has("open")) {
    const open = z.enum(["true", "false"]).parse(params.get("open"));
    if (open === "true")
      clauses.push({ status: { in: [...activeBorrowStatuses] } });
  }
  return clauses.length ? { AND: clauses } : {};
}
export function summarizeBorrow<
  T extends {
    status: string;
    expectedReturnDate: Date;
    items: {
      quantityBorrowed: number;
      quantityReturned: number;
      quantityCancelled: number;
    }[];
  },
>(record: T) {
  return {
    ...record,
    status: borrowState(record),
    daysOverdue:
      borrowState(record) === "OVERDUE"
        ? daysOverdue(record.expectedReturnDate)
        : 0,
    quantityBorrowed: record.items.reduce((n, i) => n + i.quantityBorrowed, 0),
    quantityReturned: record.items.reduce((n, i) => n + i.quantityReturned, 0),
    quantityOutstanding: record.items.reduce((n, i) => n + outstanding(i), 0),
    items: record.items.map((i) => ({
      ...i,
      quantityOutstanding: outstanding(i),
    })),
  };
}
export async function listBorrowing(params: URLSearchParams) {
  let page = pageNumber(params);
  const sort = z
    .enum([
      "borrowedDate",
      "expectedReturnDate",
      "borrowerName",
      "transactionNumber",
      "finalReturnDate",
    ])
    .parse(params.get("sort") ?? "borrowedDate");
  const direction = z
    .enum(["asc", "desc"])
    .parse(params.get("direction") ?? "desc");
  const where = borrowingWhere(params);
  return db.$transaction(
    async (tx) => {
      const total = await tx.borrowTransaction.count({ where });
      page = Math.min(page, Math.max(1, Math.ceil(total / 20)));
      const items = await tx.borrowTransaction.findMany({
        where,
        include: { items: true },
        orderBy: [{ [sort]: direction }, { id: "asc" }],
        skip: (page - 1) * 20,
        take: 20,
      });
      return { items: items.map(summarizeBorrow), page, total };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function borrowDetail(id: string) {
  const [record] = await db.$transaction(
    [
      db.borrowTransaction.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { id: "asc" },
            include: {
              inventoryItem: {
                select: {
                  isActive: true,
                  borrowedQuantity: true,
                  availableQuantity: true,
                },
              },
            },
          },
          returns: {
            include: {
              items: {
                include: {
                  damage: { select: { id: true, status: true } },
                  loss: { select: { id: true, status: true } },
                },
              },
            },
            orderBy: [{ returnDate: "asc" }, { createdAt: "asc" }],
          },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  if (!record) throw new AppError("Borrow transaction not found", 404);
  return summarizeBorrow(record);
}
export async function borrowingDashboard() {
  const today = laboratoryToday();
  const [active, damaged, lost, units] = await Promise.all([
    db.borrowTransaction.findMany({
      where: { status: { in: [...activeBorrowStatuses] } },
      include: { items: true },
      orderBy: [{ expectedReturnDate: "asc" }, { id: "asc" }],
    }),
    db.returnTransactionItem.aggregate({
      where: { returnCondition: "DAMAGED" },
      _sum: { quantityReturned: true },
    }),
    db.returnTransactionItem.aggregate({
      where: { returnCondition: "LOST_MISSING" },
      _sum: { quantityReturned: true },
    }),
    db.inventoryItem.aggregate({ _sum: { borrowedQuantity: true } }),
  ]);
  const rows = active.map(summarizeBorrow);
  return {
    cards: {
      "Currently Borrowed Items": units._sum.borrowedQuantity ?? 0,
      "Active Borrow Transactions": active.length,
      "Overdue Transactions": rows.filter((r) => r.status === "OVERDUE").length,
      "Items Due Today": rows
        .filter(
          (r) => r.expectedReturnDate.toISOString().slice(0, 10) === today,
        )
        .reduce((n, r) => n + r.quantityOutstanding, 0),
      "Damaged Returns": damaged._sum.quantityReturned ?? 0,
      "Lost Borrowed Items": lost._sum.quantityReturned ?? 0,
    },
    due: rows
      .filter((r) => r.expectedReturnDate.toISOString().slice(0, 10) <= today)
      .slice(0, 8),
  };
}
