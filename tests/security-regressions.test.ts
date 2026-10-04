import { describe, it, expect } from "vitest";
import { requestKey } from "../lib/request-id";
import { allowedOrigin } from "../lib/origin";
import { csvCell } from "../lib/csv";
import { jsonObject } from "../lib/http";
import { dateRange } from "../lib/query-validation";

describe("audit security and retry regressions", () => {
  it("deduplicates identical retries and assigns edited submissions a new key", () => {
    const first = requestKey(null, { quantity: 2 });
    expect(requestKey(first, { quantity: 2 })).toEqual(first);
    expect(requestKey(first, { quantity: 3 }).id).not.toBe(first.id);
    expect(requestKey(null, { quantity: 2 }).id).not.toBe(first.id);
  });
  it("permits development loopback aliases only on the configured protocol and port", () => {
    const configured = "http://localhost:3000";
    expect(allowedOrigin("http://127.0.0.1:3000", configured, true)).toBe(true);
    expect(allowedOrigin("http://[::1]:3000", configured, true)).toBe(true);
    for (const origin of [
      null,
      "null",
      "http://localhost:3001",
      "https://localhost:3000",
      "http://localhost.evil.test:3000",
      "http://127.0.0.1:3000/path",
    ])
      expect(allowedOrigin(origin, configured, true)).toBe(false);
    expect(allowedOrigin("http://127.0.0.1:3000", configured, false)).toBe(
      false,
    );
    expect(allowedOrigin(configured, configured, false)).toBe(true);
    expect(
      allowedOrigin("http://localhost:3000", "https://inventory.example", true),
    ).toBe(false);
  });
  it.each(["=1+1", " +SUM(A1)", "\n=1+1", "\t@SUM(A1)", "\r-1+1"])(
    "escapes spreadsheet formulas %j",
    (value) => {
      expect(csvCell(value).startsWith("\"'")).toBe(true);
    },
  );
  it("preserves and quotes ordinary CSV text", () => {
    expect(csvCell('Mixer "A", blue')).toBe('"Mixer ""A"", blue"');
  });
  it.each([
    "text/application/json",
    "application/jsonp",
    "application/json-malicious",
  ])("rejects lookalike JSON media types %s", async (contentType) => {
    await expect(
      jsonObject(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("accepts JSON with charset parameters", async () => {
    await expect(
      jsonObject(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: "{}",
        }),
      ),
    ).resolves.toEqual({});
  });
  it("filters timestamped activity by the Manila calendar day", () => {
    const range = dateRange(
      new URLSearchParams("from=2026-10-04&to=2026-10-04"),
      true,
    );
    expect(range.gte?.toISOString()).toBe("2026-10-03T16:00:00.000Z");
    expect(range.lte?.toISOString()).toBe("2026-10-04T15:59:59.999Z");
    expect(
      dateRange(new URLSearchParams("from=2026-10-04")).gte?.toISOString(),
    ).toBe("2026-10-04T00:00:00.000Z");
  });
});
