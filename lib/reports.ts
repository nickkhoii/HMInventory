import { db } from "./db";
import { inventoryWhere, label } from "./queries";
import { AppError } from "./errors";
import { reportKinds, isBorrowReport, type ReportKind } from "./report-kinds";
import { borrowReportData } from "./borrow-reports";
import { z } from "zod";
import { dateRange } from "./query-validation";
import { decimalTotal } from "./money";
export async function generateReport(params: URLSearchParams) {
  const kind = (params.get("kind") ?? "complete") as ReportKind;
  if (!reportKinds.includes(kind)) throw new AppError("Invalid report type");
  const where = inventoryWhere(params);
  const dates = dateRange(params);
  // Dates apply to acquisition for inventory reports and event dates for movement/incident reports.
  const eventWhere = { ...where };
  delete eventWhere.dateAcquired;
  if (!params.has("archived") || !params.get("archived"))
    delete eventWhere.isActive;
  const format = params.get("format");
  if (format && !["csv", "pdf", "json"].includes(format))
    throw new AppError("Invalid report format");
  const status = params.get("status");
  let columns: string[], rows: (string | number)[][];
  if (isBorrowReport(kind)) {
    ({ columns, rows } = await borrowReportData(params));
  } else if (["stock-in", "stock-out"].includes(kind)) {
    const txs = await db.inventoryTransaction.findMany({
      where: {
        type: kind === "stock-in" ? "STOCK_IN" : "STOCK_OUT",
        transactionDate: dates,
        item: eventWhere,
      },
      include: { item: true },
      take: 5001,
      orderBy: { transactionDate: "desc" },
    });
    columns = [
      "Transaction",
      "Date",
      "Code",
      "Item",
      "Quantity",
      "Previous",
      "New",
      "Remarks",
    ];
    rows = txs.map((t) => [
      t.transactionNumber,
      t.transactionDate.toISOString().slice(0, 10),
      t.item.inventoryCode,
      t.item.name,
      t.quantity,
      t.previousQuantity,
      t.newQuantity,
      t.remarks,
    ]);
  } else if (["damaged", "repair"].includes(kind)) {
    const records = await db.damageRecord.findMany({
      where: {
        item: eventWhere,
        dateReported: dates,
        ...(kind === "repair"
          ? { status: "FOR_REPAIR" as const }
          : status
            ? {
                status: z
                  .enum([
                    "FOR_ASSESSMENT",
                    "FOR_REPAIR",
                    "REPAIRED",
                    "BEYOND_REPAIR",
                    "DISPOSED",
                  ])
                  .parse(status),
              }
            : {}),
      },
      include: { item: true },
      take: 5001,
      orderBy: { dateReported: "desc" },
    });
    columns = [
      "Code",
      "Item",
      "Quantity",
      "Date",
      "Description",
      "Action",
      "Status",
    ];
    rows = records.map((r) => [
      r.item.inventoryCode,
      r.item.name,
      r.quantity,
      r.dateReported.toISOString().slice(0, 10),
      r.description,
      r.actionTaken,
      label(r.status),
    ]);
  } else if (kind === "lost") {
    const records = await db.lostItemRecord.findMany({
      where: {
        item: eventWhere,
        dateReported: dates,
        ...(status
          ? {
              status: z
                .enum([
                  "MISSING",
                  "UNDER_INVESTIGATION",
                  "RECOVERED",
                  "DECLARED_LOST",
                ])
                .parse(status),
            }
          : {}),
      },
      include: { item: true },
      take: 5001,
      orderBy: { dateReported: "desc" },
    });
    columns = ["Code", "Item", "Quantity", "Date", "Description", "Status"];
    rows = records.map((r) => [
      r.item.inventoryCode,
      r.item.name,
      r.quantity,
      r.dateReported.toISOString().slice(0, 10),
      r.description,
      label(r.status),
    ]);
  } else if (kind === "disposal") {
    const records = await db.disposalRecord.findMany({
      where: { item: eventWhere, disposalDate: dates },
      include: { item: true },
      take: 5001,
      orderBy: { disposalDate: "desc" },
    });
    columns = ["Code", "Item", "Quantity", "Date", "Reason", "Method"];
    rows = records.map((r) => [
      r.item.inventoryCode,
      r.item.name,
      r.quantity,
      r.disposalDate.toISOString().slice(0, 10),
      r.reason,
      r.method,
    ]);
  } else {
    if (kind === "low-stock")
      where.AND = [
        { availableQuantity: { gt: 0 } },
        { availableQuantity: { lte: db.inventoryItem.fields.minimumStock } },
      ];
    if (kind === "out-of-stock") where.availableQuantity = 0;
    const items = await db.inventoryItem.findMany({
      where,
      include: { category: true, location: true },
      take: 5001,
      orderBy:
        kind === "category"
          ? [{ category: { name: "asc" } }, { name: "asc" }]
          : kind === "location"
            ? [{ location: { name: "asc" } }, { name: "asc" }]
            : kind === "condition"
              ? [{ condition: "asc" }, { name: "asc" }]
              : { name: "asc" },
    });
    columns = [
      "Code",
      "Item",
      "Category",
      "Location",
      "Condition",
      "Quantity",
      "Available",
      "Unit cost",
      "Total value",
    ];
    rows = items.map((i) => [
      i.inventoryCode,
      i.name,
      i.category.name,
      i.location.name,
      label(i.condition),
      i.quantity,
      i.availableQuantity,
      i.unitCost.toFixed(2),
      i.totalValue.toFixed(2),
    ]);
  }
  if (rows.length > 5000)
    throw new AppError(
      "Reports support up to 5,000 records. Narrow the filters before generating or exporting",
    );
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const lookupNames: Record<string, string> = {};
  if (params.get("category"))
    lookupNames.category =
      (await db.category.findUnique({ where: { id: params.get("category")! } }))
        ?.name ?? params.get("category")!;
  if (params.get("location"))
    lookupNames.location =
      (await db.location.findUnique({ where: { id: params.get("location")! } }))
        ?.name ?? params.get("location")!;
  const filters =
    [...params.entries()]
      .filter(([k, v]) => !["format", "kind"].includes(k) && v)
      .map(([k, v]) => `${label(k)}: ${lookupNames[k] ?? label(v)}`)
      .join(" · ") ||
    (kind === "complete" ||
    ["category", "location", "condition", "low-stock", "out-of-stock"].includes(
      kind,
    )
      ? "All active inventory"
      : "All inventory, including archived");
  const totalQuantity = rows.reduce(
    (sum, row) => sum + Number(row[columns.indexOf("Quantity")] || 0),
    0,
  );
  const totalValue = columns.includes("Total value")
    ? decimalTotal(rows.map((row) => row[columns.indexOf("Total value")]))
    : null;
  await db.activityLog.create({
    data: {
      action: "Generated Report",
      description: `${kind}: ${rows.length} records. ${filters}`,
    },
  });
  return {
    title: `${label(kind.replaceAll("-", "_"))} Report`,
    header:
      settings?.reportHeader ?? "HM Laboratory Inventory Management System",
    institution: settings?.institutionName ?? "",
    laboratory: settings?.laboratoryName ?? "",
    generatedAt: new Date().toISOString(),
    filters,
    columns,
    rows,
    totalQuantity,
    totalValue,
  };
}
export function csvCell(value: string | number) {
  const s = String(value);
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
}
