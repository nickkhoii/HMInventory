import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/client-api";

afterEach(() => vi.unstubAllGlobals());

describe("API response handling", () => {
  it("explains an HTML gateway error without exposing its contents", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Gateway error</html>", { status: 502 }),
        ),
    );
    await expect(api("inventory")).rejects.toThrow(
      "Request failed (502). Please try again.",
    );
  });
  it("redirects expired sessions even if the error response is not JSON", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })),
    );
    await expect(api("settings")).rejects.toThrow("Request failed (401)");
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hm:session-expired" }),
    );
  });
  it.each([null, {}, { error: 42 }])(
    "handles malformed error payload %j",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json(body, { status: 503 })),
      );
      await expect(api("inventory")).rejects.toThrow("Request failed (503)");
    },
  );
  it("preserves validation messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "Insufficient stock" }, { status: 400 }),
        ),
    );
    await expect(api("movements", "POST", {})).rejects.toThrow(
      "Insufficient stock",
    );
  });
});
