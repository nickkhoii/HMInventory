import { z } from "zod";
import { dateSchema } from "./validation";
export function pageNumber(params: URLSearchParams) {
  return z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(params.get("page") ?? "1");
}
export function dateRange(params: URLSearchParams) {
  const from = params.get("from"),
    to = params.get("to");
  const start = from ? dateSchema.parse(from) : undefined,
    end = to ? dateSchema.parse(to) : undefined;
  if (start && end && start > end)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["to"],
        message: "End date must be on or after start date",
      },
    ]);
  return {
    gte: start ? new Date(start) : undefined,
    lte: end ? new Date(`${end}T23:59:59.999Z`) : undefined,
  };
}
export function archiveFilter(params: URLSearchParams) {
  return z
    .enum(["true", "false", "all"])
    .parse(params.get("archived") ?? "false");
}
