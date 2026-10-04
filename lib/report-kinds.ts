export const borrowReportKinds = [
  "currently-borrowed",
  "borrowing-history",
  "return-history",
  "overdue-items",
  "borrowing-by-student",
  "borrowing-by-faculty",
  "borrowing-by-department",
  "damaged-returned-items",
  "lost-borrowed-items",
  "borrowing-by-date-range",
] as const;
export const isBorrowReport = (kind: string) =>
  (borrowReportKinds as readonly string[]).includes(kind);
export const reportKinds = [
  ...borrowReportKinds,
  "complete",
  "category",
  "location",
  "condition",
  "valuation",
  "stock-in",
  "stock-out",
  "low-stock",
  "out-of-stock",
  "damaged",
  "repair",
  "lost",
  "disposal",
] as const;
export type ReportKind = (typeof reportKinds)[number];
