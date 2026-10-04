import { Prisma } from "@prisma/client";
import { db } from "./db";
import { inventoryWhere, label } from "./queries";
import { borrowingWhere, activeBorrowStatuses } from "./borrow-queries";
import { dateRange } from "./query-validation";
import {
  borrowState,
  outstanding,
  laboratoryToday,
  daysOverdue,
} from "./borrow-rules";
export async function borrowReportData(params: URLSearchParams) {
  const kind = params.get("kind")!;
  const returns = [
    "return-history",
    "damaged-returned-items",
    "lost-borrowed-items",
  ].includes(kind);
  const filters = new URLSearchParams(params);
  if (returns) {
    filters.delete("from");
    filters.delete("to");
    filters.delete("search");
  }
  const borrow: Prisma.BorrowTransactionWhereInput = borrowingWhere(filters);
  if (kind === "borrowing-by-student") borrow.borrowerType = "STUDENT";
  if (kind === "borrowing-by-faculty") borrow.borrowerType = "FACULTY";
  if (kind === "borrowing-by-department") borrow.borrowerType = "DEPARTMENT";
  if (["currently-borrowed", "overdue-items"].includes(kind))
    borrow.status = { in: [...activeBorrowStatuses] };
  if (kind === "overdue-items")
    borrow.expectedReturnDate = { lt: new Date(laboratoryToday()) };
  const item = inventoryWhere(params);
  delete item.dateAcquired;
  delete item.OR;
  if (!params.has("archived")) delete item.isActive;
  if (returns) {
    const records = await db.returnTransactionItem.findMany({
      where: {
        returnTransaction: {
          returnDate: dateRange(params),
          borrowTransaction: borrow,
          ...(params.get("search")
            ? {
                OR: [
                  {
                    returnNumber: {
                      contains: params.get("search")!.trim().slice(0, 200),
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    borrowTransaction: borrowingWhere(
                      new URLSearchParams({ search: params.get("search")! }),
                    ),
                  },
                ],
              }
            : {}),
        },
        borrowTransactionItem: { inventoryItem: item },
        ...(kind === "damaged-returned-items"
          ? { returnCondition: "DAMAGED" as const }
          : kind === "lost-borrowed-items"
            ? { returnCondition: "LOST_MISSING" as const }
            : {}),
      },
      include: {
        returnTransaction: { include: { borrowTransaction: true } },
        borrowTransactionItem: true,
      },
      orderBy: [{ returnTransaction: { returnDate: "desc" } }, { id: "asc" }],
      take: 5001,
    });
    return {
      columns: [
        "Return",
        "Borrow transaction",
        "Borrower",
        "Type",
        "ID number",
        "Date",
        "Code",
        "Item",
        "Quantity",
        "Return condition",
        "Damage / loss description",
        "Action required",
        "Remarks",
      ],
      rows: records.map((r) => [
        r.returnTransaction.returnNumber,
        r.returnTransaction.borrowTransaction.transactionNumber,
        r.returnTransaction.borrowTransaction.borrowerName,
        label(r.returnTransaction.borrowTransaction.borrowerType),
        r.returnTransaction.borrowTransaction.borrowerIdNumber,
        r.returnTransaction.returnDate.toISOString().slice(0, 10),
        r.borrowTransactionItem.inventoryCode,
        r.borrowTransactionItem.itemName,
        r.quantityReturned,
        label(r.returnCondition),
        r.damageDescription,
        r.actionRequired,
        r.remarks,
      ]),
    };
  }
  const records = await db.borrowTransactionItem.findMany({
    where: {
      borrowTransaction: borrow,
      inventoryItem: item,
      ...(["currently-borrowed", "overdue-items"].includes(kind)
        ? {
            quantityReturned: {
              lt: db.borrowTransactionItem.fields.quantityBorrowed,
            },
          }
        : {}),
    },
    include: { borrowTransaction: { include: { items: true } } },
    orderBy: [{ borrowTransaction: { borrowedDate: "desc" } }, { id: "asc" }],
    take: 5001,
  });
  return {
    columns: [
      "Transaction",
      "Borrower",
      "Type",
      "ID number",
      "Program / Department",
      "Date borrowed",
      "Expected return",
      "Final return",
      "Code",
      "Item",
      "Quantity",
      "Borrowed",
      "Returned",
      "Outstanding",
      "Condition before release",
      "Status",
      "Days overdue",
      "Purpose",
      "Remarks",
    ],
    rows: records.map((r) => {
      const b = r.borrowTransaction,
        status = borrowState(b);
      return [
        b.transactionNumber,
        b.borrowerName,
        label(b.borrowerType),
        b.borrowerIdNumber,
        [b.program, b.department].filter(Boolean).join(" / "),
        b.borrowedDate.toISOString().slice(0, 10),
        b.expectedReturnDate.toISOString().slice(0, 10),
        b.finalReturnDate?.toISOString().slice(0, 10) ?? "",
        r.inventoryCode,
        r.itemName,
        ["currently-borrowed", "overdue-items"].includes(kind)
          ? outstanding(r)
          : r.quantityBorrowed,
        r.quantityBorrowed,
        r.quantityReturned,
        outstanding(r),
        label(r.conditionBeforeRelease),
        label(status),
        status === "OVERDUE" ? daysOverdue(b.expectedReturnDate) : 0,
        b.purpose,
        r.remarks,
      ];
    }),
  };
}
