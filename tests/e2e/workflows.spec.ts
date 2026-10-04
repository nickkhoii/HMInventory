import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import "dotenv/config";
const username = process.env.ADMIN_USERNAME || "administrator";
const password = process.env.ADMIN_INITIAL_PASSWORD;
if (!password)
  throw new Error(
    "Set ADMIN_INITIAL_PASSWORD to the seeded test account password",
  );
const origin = "http://localhost:3000";
test.describe("Authentication and complete browser workflows", () => {
  test("protects routes, rejects forged sessions and cross-origin requests", async ({
    request,
  }) => {
    const anonymous = await request.get("/api/inventory");
    expect(anonymous.status()).toBe(401);
    const route = await request.get("/inventory", { maxRedirects: 0 });
    expect(route.status()).toBe(307);
    expect(route.headers().location).toContain("/login");
    const forged = await request.get("/api/settings", {
      headers: { Cookie: "hm_session=forged" },
    });
    expect(forged.status()).toBe(401);
    const forgedPage = await request.get("/inventory", {
      headers: { Cookie: "hm_session=forged" },
      maxRedirects: 0,
    });
    expect(forgedPage.status()).toBe(307);
    const csrf = await request.post("/api/auth/login", {
      headers: { Origin: "https://malicious.example" },
      data: { username, password },
    });
    expect(csrf.status()).toBe(403);
  });
  test("rejects invalid credentials and signs in through the real form", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Username", exact: true })
      .fill(username);
    await page
      .getByLabel("Password", { exact: true })
      .fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid username or password" }),
    ).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Inventory by category", { exact: true }),
    ).toBeVisible();
    const session = (await page.context().cookies()).find(
      (c) => c.name === "hm_session",
    );
    expect(session?.httpOnly).toBe(true);
    if (process.env.E2E_PRODUCTION === "true")
      expect(session?.secure).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    await page.screenshot({
      path: "test-results/dashboard-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL("/login");
    expect((await page.request.get("/api/inventory")).status()).toBe(401);
  });
  test("creates and edits lookups and inventory, moves stock and exports reports", async ({
    page,
  }) => {
    const login = await page.request.post("/api/auth/login", {
      headers: { Origin: origin },
      data: { username, password },
    });
    expect(login.status()).toBe(200);
    const suffix = randomUUID().slice(0, 8),
      name = `Browser Mixer ${suffix}`,
      code = `HM-E2E-${suffix}`;
    await page.goto("/categories");
    await page
      .getByRole("button", { name: "Add category", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Name", { exact: false })
      .fill(`Browser category ${suffix}`);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Browser category ${suffix}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/inventory");
    await page
      .getByRole("button", { name: "Add inventory item", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Inventory code", { exact: false }).fill(code);
    await dialog.getByLabel("Item name", { exact: false }).fill(name);
    await dialog
      .getByLabel("Category", { exact: false })
      .selectOption({ label: `Browser category ${suffix}` });
    await dialog
      .getByLabel("Location", { exact: false })
      .selectOption({ label: "Main Kitchen Laboratory" });
    await dialog.getByLabel("Initial quantity", { exact: false }).fill("10");
    await dialog.getByLabel("Minimum stock level", { exact: false }).fill("3");
    await dialog.getByLabel("Unit cost (PHP)", { exact: false }).fill("150");
    await dialog
      .getByRole("button", { name: "Save inventory item", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: new RegExp(name) }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Brand", { exact: true })
      .fill("TestBrand");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save inventory item", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.goto("/stock-in");
    await page
      .getByLabel("Inventory item", { exact: false })
      .selectOption({ label: `${code} · ${name}` });
    await page.getByLabel("Quantity", { exact: false }).fill("5");
    await page.getByLabel("Unit cost (PHP)", { exact: false }).fill("150");
    await page
      .getByRole("button", { name: "Record Stock In", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Stock movement recorded" }),
    ).toContainText("Stock movement recorded");
    await page.goto("/stock-out");
    await page
      .getByLabel("Inventory item", { exact: false })
      .selectOption({ label: `${code} · ${name}` });
    await page.getByLabel("Quantity", { exact: false }).fill("100");
    await page.getByLabel("Purpose", { exact: false }).fill("Practical class");
    await page
      .getByRole("button", { name: "Record Stock Out", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "exceeds available" }),
    ).toBeVisible();
    await page.getByLabel("Quantity", { exact: false }).fill("2");
    await page
      .getByRole("button", { name: "Record Stock Out", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Stock movement recorded" }),
    ).toContainText("Stock movement recorded");
    await page.goto(`/inventory?search=${code}`);
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(
      page.getByRole("heading", { name: "Stock In · 5 units", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Stock Out · 2 units", exact: true }),
    ).toBeVisible();
    await page.goto("/adjustments");
    await page
      .getByLabel("Adjustment type", { exact: true })
      .selectOption("LOST");
    await page
      .getByRole("combobox", { name: "Inventory item", exact: true })
      .selectOption({ label: `${code} · ${name}` });
    await page
      .getByRole("spinbutton", { name: "Quantity", exact: true })
      .fill("2");
    await page
      .getByLabel("Reason / description", { exact: false })
      .fill("Reported missing for recovery verification");
    await page
      .getByRole("button", { name: "Record Lost", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Stock movement recorded" }),
    ).toBeVisible();
    await page
      .getByLabel("Adjustment type", { exact: true })
      .selectOption("RECOVERY");
    await page
      .getByRole("combobox", { name: "Inventory item", exact: true })
      .selectOption({ label: `${code} · ${name}` });
    await page
      .getByRole("combobox", { name: "Missing record to recover", exact: true })
      .selectOption({ index: 1 });
    await page
      .getByLabel("Reason / description", { exact: false })
      .fill("Found in storage");
    await page
      .getByRole("button", { name: "Record Recovery", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Stock movement recorded" }),
    ).toBeVisible();
    await page.goto("/reports");
    await page
      .getByLabel("Category", { exact: true })
      .selectOption({ label: `Browser category ${suffix}` });
    await page
      .getByRole("button", { name: "Generate report", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: code, exact: true }),
    ).toBeVisible();
    const csv = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV", exact: true }).click();
    expect((await csv).suggestedFilename()).toBe("hm-report.csv");
    const pdf = page.waitForEvent("download");
    await page.getByRole("link", { name: "PDF", exact: true }).click();
    expect((await pdf).suggestedFilename()).toBe("hm-report.pdf");
    const exportResponse = await page.request.get("/api/reports?format=pdf");
    expect(exportResponse.status()).toBe(200);
    expect((await exportResponse.body()).subarray(0, 4).toString()).toBe(
      "%PDF",
    );
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".sidebar")).not.toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "HM Laboratory Inventory Management System",
        exact: true,
      }),
    ).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });
  test("mobile navigation is usable without horizontal page overflow", async ({
    page,
  }) => {
    const login = await page.request.post("/api/auth/login", {
      headers: { Origin: origin },
      data: { username, password, remember: true },
    });
    expect(login.status()).toBe(200);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page.getByRole("link", { name: "Inventory", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Inventory", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/inventory-mobile.png",
      fullPage: true,
    });
  });
});
