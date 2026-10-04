import type { Condition, Prisma } from "@prisma/client";
const usable: Condition[] = ["NEW", "GOOD", "FAIR"];
export async function reconcileCondition(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    quantity: number;
    availableQuantity: number;
    condition: Condition;
    borrowedQuantity?: number;
  },
  reason: string,
  disposed = false,
) {
  let current: Condition = item.condition;
  if (item.availableQuantity > 0) {
    if (!usable.includes(current)) current = "GOOD";
  } else if (item.quantity === 0) {
    if (disposed) current = "DISPOSED";
    else if (!usable.includes(current)) current = "GOOD";
  } else {
    const damages = await tx.damageRecord.findMany({
      where: { itemId: item.id, status: { notIn: ["REPAIRED", "DISPOSED"] } },
      select: { status: true },
    });
    const missing = await tx.lostItemRecord.count({
      where: { itemId: item.id, status: { not: "RECOVERED" } },
    });
    current = damages.length
      ? damages.some((d) => d.status === "FOR_REPAIR")
        ? "FOR_REPAIR"
        : "DAMAGED"
      : missing > 0
        ? "LOST_MISSING"
        : usable.includes(current)
          ? current
          : "GOOD";
  }
  if (current !== item.condition) {
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { condition: current },
    });
    await tx.conditionHistory.create({
      data: { itemId: item.id, previous: item.condition, current, reason },
    });
  }
  return current;
}
