import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import "dotenv/config";
import { assertTestDatabase } from "../../lib/test-database";
const db = new PrismaClient();
const origin = "http://localhost:3000";
test.beforeEach(async ({ page }) => {
  const request = page.request;
  assertTestDatabase(process.env.DATABASE_URL);
  await db.loginAttempt.deleteMany();
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: {
          username: process.env.ADMIN_USERNAME || "administrator",
          password: process.env.ADMIN_INITIAL_PASSWORD,
        },
      })
    ).status(),
  ).toBe(200);
});
test.afterAll(() => db.$disconnect());
test("URL navigation updates filters and archived incidents can be restored and repaired", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8),
    name = `Restore fixture ${suffix}`;
  const options = await (await page.request.get("/api/options")).json();
  const created = await page.request.post("/api/inventory", {
    headers: { Origin: origin },
    data: {
      inventoryCode: `RESTORE-${suffix}`,
      name,
      categoryId: options.categories.find(
        (c: { isActive: boolean }) => c.isActive,
      ).id,
      locationId: options.locations.find(
        (c: { isActive: boolean }) => c.isActive,
      ).id,
      quantity: 2,
      unit: "piece",
      unitCost: 10,
      minimumStock: 0,
      condition: "GOOD",
      dateAcquired: "2026-10-04",
    },
  });
  expect(created.status()).toBe(200);
  const item = await created.json();
  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    (search) =>
      window.history.pushState(null, "", `/inventory?search=${search}`),
    name,
  );
  await expect(page.getByRole("link", { name, exact: false })).toBeVisible();
  await page.evaluate(() =>
    window.history.pushState(
      null,
      "",
      "/inventory?search=absent-browser-record",
    ),
  );
  await expect(
    page.getByText("No inventory matches your filters"),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("link", { name, exact: false })).toBeVisible();
  expect(
    (
      await page.request.post("/api/movements", {
        headers: { Origin: origin },
        data: {
          itemId: item.id,
          type: "DAMAGE",
          quantity: 2,
          date: "2026-10-04",
          reason: "Inspection",
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(`/api/inventory/${item.id}`, {
        headers: { Origin: origin },
        data: { action: "archive" },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/damaged");
  let row = page.getByRole("row").filter({ hasText: name });
  await expect(
    row.getByRole("button", { name: "Repair", exact: true }),
  ).toHaveCount(0);
  await row
    .getByRole("link", { name: "Restore inventory to resolve this record" })
    .click();
  await page
    .getByRole("button", { name: "Restore inventory", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restore inventory", exact: true }),
  ).toHaveCount(0);
  await page.goto("/damaged");
  row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "Repair", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Record Repair",
    exact: true,
  });
  await dialog
    .getByLabel("Reason", { exact: false })
    .fill("Repaired after inspection");
  await dialog
    .getByRole("button", { name: "Record Repair", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await (await page.request.get(`/api/inventory/${item.id}`)).json())
      .availableQuantity,
  ).toBe(2);
});
test("invalid bodies and query filters produce client errors", async ({
  page,
}) => {
  const request = page.request;
  for (const body of ["{", "null", "[]"])
    expect(
      (
        await request.post("/api/movements", {
          headers: { Origin: origin, "Content-Type": "application/json" },
          data: body,
        })
      ).status(),
    ).toBe(400);
  for (const path of [
    "inventory?page=NaN",
    "transactions?page=Infinity",
    "activity?from=2026-02-30",
    "inventory?stock=invalid",
    "reports?from=2026-10-05&to=2026-10-04",
    "reports?format=invalid",
  ])
    expect((await request.get(`/api/${path}`)).status(), path).toBe(400);
  expect((await request.get("/api/settings/unexpected")).status()).toBe(404);
});
test("nonce policy blocks injected inline scripts while all modules work", async ({
  page,
}) => {
  const request = page.request;
  const first = await request.get("/login"),
    second = await request.get("/login");
  const policy = first.headers()["content-security-policy"];
  expect(policy).toContain("'nonce-");
  if (process.env.E2E_PRODUCTION === "true")
    expect(policy).not.toContain("unsafe-eval");
  expect(
    policy.split(";").find((part) => part.includes("script-src")),
  ).not.toContain("unsafe-inline");
  expect(second.headers()["content-security-policy"]).not.toBe(policy);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const section of [
    "dashboard",
    "inventory",
    "categories",
    "locations",
    "borrow-items",
    "return-items",
    "borrowing-history",
    "stock-in",
    "stock-out",
    "adjustments",
    "damaged",
    "lost",
    "disposal",
    "transactions",
    "reports",
    "activity",
    "settings",
  ]) {
    await page.goto(`/${section}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Loading laboratory records" }),
    ).toHaveCount(0);
  }
  const nonce = policy.match(/'nonce-([^']+)'/)![1];
  await page.route("**/csp-check", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Content-Security-Policy": policy,
      },
      body: `<!doctype html><html><body><script nonce="${nonce}">window.__hmTrusted=true</script><script>window.__hmInjected=true</script></body></html>`,
    }),
  );
  await page.goto("/csp-check");
  expect(await page.evaluate(() => "__hmTrusted" in window)).toBe(true);
  expect(await page.evaluate(() => "__hmInjected" in window)).toBe(false);
  expect(errors).toEqual([]);
});
test("expired browser sessions redirect and logout clears expired cookies", async ({
  page,
}) => {
  const request = page.request;
  await page.goto("/inventory");
  await expect(
    page.getByRole("button", { name: "Add inventory item", exact: true }),
  ).toBeVisible();
  const cookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "hm_session",
  )!;
  await db.session.update({
    where: { id: createHash("sha256").update(cookie.value).digest("hex") },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await page
    .getByLabel("Stock level", { exact: true })
    .selectOption("OUT_OF_STOCK");
  await expect(page).toHaveURL("/login");
  expect(
    (
      await request.post("/api/auth/logout", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(200);
  expect(
    (await request.storageState()).cookies.some(
      (cookie) => cookie.name === "hm_session",
    ),
  ).toBe(false);
});
