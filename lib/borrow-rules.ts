export const borrowerTypes = [
  "STUDENT",
  "FACULTY",
  "STAFF",
  "DEPARTMENT",
  "ORGANIZATION",
  "OTHER",
] as const;
export const borrowStatuses = [
  "BORROWED",
  "PARTIALLY_RETURNED",
  "RETURNED",
  "OVERDUE",
  "CANCELLED",
] as const;
export const returnConditions = [
  "GOOD",
  "FAIR",
  "DAMAGED",
  "LOST_MISSING",
] as const;
export function laboratoryToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function outstanding(item: {
  quantityBorrowed: number;
  quantityReturned: number;
  quantityCancelled?: number;
}) {
  return (
    item.quantityBorrowed -
    item.quantityReturned -
    (item.quantityCancelled ?? 0)
  );
}
export function borrowState(
  record: {
    status: string;
    expectedReturnDate: Date | string;
    items: {
      quantityBorrowed: number;
      quantityReturned: number;
      quantityCancelled?: number;
    }[];
  },
  today = laboratoryToday(),
) {
  if (record.status === "CANCELLED") return "CANCELLED";
  const pending = record.items.reduce((n, item) => n + outstanding(item), 0);
  if (pending === 0) return "RETURNED";
  const due = new Date(record.expectedReturnDate).toISOString().slice(0, 10);
  if (due < today) return "OVERDUE";
  return record.items.some((item) => item.quantityReturned > 0)
    ? "PARTIALLY_RETURNED"
    : "BORROWED";
}
export function daysOverdue(
  expected: Date | string,
  today = laboratoryToday(),
) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(today) -
        Date.parse(new Date(expected).toISOString().slice(0, 10))) /
        86400000,
    ),
  );
}
