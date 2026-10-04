import { AppError } from "./errors";
import type { Operation } from "./validation";
export function stockLevel(available: number, minimum: number) {
  return available === 0
    ? "OUT_OF_STOCK"
    : available <= minimum
      ? "LOW_STOCK"
      : "AVAILABLE";
}
export function calculateMovement(
  current: { quantity: number; availableQuantity: number },
  operation: Pick<Operation, "type" | "quantity">,
) {
  let { quantity, availableQuantity } = current;
  const n = operation.quantity;
  if (
    !Number.isSafeInteger(n) ||
    n < 0 ||
    (operation.type !== "PHYSICAL_COUNT" && n === 0)
  )
    throw new AppError("Invalid quantity");
  switch (operation.type) {
    case "STOCK_IN":
    case "ADD":
    case "RETURNED":
    case "OTHER":
      quantity += n;
      availableQuantity += n;
      break;
    case "STOCK_OUT":
    case "DEDUCT":
    case "DISPOSAL":
      quantity -= n;
      availableQuantity -= n;
      break;
    case "DAMAGE":
    case "LOST":
      availableQuantity -= n;
      break;
    case "REPAIR":
    case "RECOVERY":
      availableQuantity += n;
      break;
    case "PHYSICAL_COUNT":
      availableQuantity = n;
      quantity = n + (current.quantity - current.availableQuantity);
      break;
  }
  if (quantity < 0 || availableQuantity < 0)
    throw new AppError("Quantity exceeds available inventory");
  if (availableQuantity > quantity)
    throw new AppError("Resolution exceeds unavailable inventory");
  if (quantity > 100000000)
    throw new AppError("Inventory quantity exceeds the supported limit");
  return { quantity, availableQuantity };
}
