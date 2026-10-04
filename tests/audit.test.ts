import { describe, it, expect } from "vitest";
import { operationSchema } from "../lib/validation";
import { pageNumber, dateRange, archiveFilter } from "../lib/query-validation";
import { jsonObject } from "../lib/http";
import { decimalTotal } from "../lib/money";
import { assertTestDatabase } from "../lib/test-database";
import { createRequire } from "node:module";
describe("audit regressions", () => {
  it("checks the actual database name rather than a credential substring", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://hm_inventory_test:password@localhost/production",
      ),
    ).toThrow();
    expect(
      assertTestDatabase(
        "postgresql://user:password@localhost/hm_inventory_test",
      ),
    ).toContain("/hm_inventory_test");
  });
  it("preserves Next lint literal and glob directory matching", () => {
    const require = createRequire(import.meta.url);
    const {
      getRootDirs,
    } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs.js");
    expect(
      getRootDirs({
        cwd: process.cwd(),
        settings: { next: { rootDir: ["app", "components"] } },
      }),
    ).toEqual(["app", "components"]);
    expect(
      getRootDirs({
        cwd: process.cwd(),
        settings: { next: { rootDir: "app/*" } },
      }),
    ).toContain("app/login");
  });
  it.each([null, true, false, "", " ", [], {}])(
    "rejects coerced invalid quantities %j",
    (quantity) => {
      expect(
        operationSchema.safeParse({
          type: "STOCK_IN",
          itemId: "item",
          date: "2026-10-04",
          unitCost: 1,
          quantity,
        }).success,
      ).toBe(false);
    },
  );
  it.each(["NaN", "Infinity", "1.5", "0", "-1", "100001"])(
    "rejects invalid pages %s",
    (page) => expect(() => pageNumber(new URLSearchParams({ page }))).toThrow(),
  );
  it("rejects impossible dates and reversed ranges", () => {
    expect(() => dateRange(new URLSearchParams("from=2026-02-30"))).toThrow();
    expect(() =>
      dateRange(new URLSearchParams("from=2026-10-05&to=2026-10-04")),
    ).toThrow();
    expect(() =>
      archiveFilter(new URLSearchParams("archived=unexpected")),
    ).toThrow();
  });
  it("keeps large currency totals exact", () =>
    expect(decimalTotal(["99999999999999999999.99", "0.02"])).toBe(
      "100000000000000000000.01",
    ));
  it.each(["{", "null", "[]", "true"])(
    "rejects malformed/nonobject JSON %s",
    async (body) => {
      await expect(
        jsonObject(
          new Request("http://localhost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it("bounds JSON bodies and requires JSON content type", async () => {
    await expect(
      jsonObject(
        new Request("http://localhost", { method: "POST", body: "{}" }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      jsonObject(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "a".repeat(65536) }),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
