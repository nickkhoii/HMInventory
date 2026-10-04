import { Prisma } from "@prisma/client";
export function decimalTotal(
  values: Iterable<string | number | Prisma.Decimal>,
) {
  const ExactDecimal = Prisma.Decimal.clone({ precision: 50 });
  let total = new ExactDecimal(0);
  for (const value of values) total = total.plus(value);
  return total.toFixed(2);
}
