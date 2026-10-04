import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { assertTestDatabase } from "../../lib/test-database";
import { laboratoryToday } from "../../lib/borrow-rules";
const db = new PrismaClient(),
  origin = "http://localhost:3000",
  today = laboratoryToday();
test.beforeEach(async ({ page }) => {
  assertTestDatabase(process.env.DATABASE_URL);
  await db.loginAttempt.deleteMany();
  expect(
    (
      await page.request.post("/api/auth/login", {
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
async function fixture(page: Page) {
  const suffix = randomUUID().slice(0, 8),
    options = await (await page.request.get("/api/options")).json();
  const response = await page.request.post("/api/inventory", {
    headers: { Origin: origin },
    data: {
      inventoryCode: `BRW-ITEM-${suffix}`,
      name: `Borrow browser ${suffix}`,
      categoryId: options.categories.find(
        (c: { isActive: boolean }) => c.isActive,
      ).id,
      locationId: options.locations.find(
        (c: { isActive: boolean }) => c.isActive,
      ).id,
      unit: "piece",
      quantity: 20,
      minimumStock: 2,
      unitCost: 10,
      dateAcquired: today,
      condition: "GOOD",
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}
async function loan(
  page: Page,
  itemId: string,
  quantity: number,
  overdue = false,
) {
  const past = new Date(Date.parse(today) - 2 * 86400000)
      .toISOString()
      .slice(0, 10),
    name = `Borrower ${randomUUID().slice(0, 8)}`;
  const response = await page.request.post("/api/borrowing", {
    headers: { Origin: origin },
    data: {
      requestId: randomUUID(),
      borrowerName: name,
      borrowerType: "FACULTY",
      purpose: "Practical assessment",
      borrowedDate: overdue ? past : today,
      expectedReturnDate: overdue ? past : today,
      items: [
        { inventoryItemId: itemId, quantity, conditionBeforeRelease: "GOOD" },
      ],
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}
test("multi-item borrowing, partial and full return, searchable history and exports", async ({
  page,
}) => {
  const first = await fixture(page),
    second = await fixture(page),
    name = `Juan browser ${randomUUID().slice(0, 8)}`,
    id = `ID-${randomUUID().slice(0, 8)}`;
  await page.goto("/borrow-items");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByLabel("Borrower name", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/borrow-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel("Borrower name", { exact: false }).fill(name);
  await page.getByLabel("ID number", { exact: true }).fill(id);
  await page.getByLabel("Course / Program", { exact: true }).fill("BSHM");
  await page
    .getByLabel("Year level / Section", { exact: true })
    .fill("BSHM 2A");
  await page
    .getByLabel("Purpose", { exact: false })
    .fill("Laboratory activity");
  await page
    .getByLabel("Inventory item 1", { exact: false })
    .selectOption(first.id);
  await page.getByLabel("Quantity borrowed 1", { exact: true }).fill("21");
  await page
    .getByRole("button", { name: "Record borrowing", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Insufficient available quantity" }),
  ).toContainText(
    "Insufficient available quantity. Only 20 item(s) are currently available.",
  );
  await page.getByLabel("Quantity borrowed 1", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByLabel("Inventory item 2", { exact: false })
    .selectOption(second.id);
  await page.getByLabel("Quantity borrowed 2", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove item 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record borrowing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/borrowing\/[^/?]+$/);
  const borrowId = page.url().split("/").pop()!;
  await expect(page.locator(".page-heading .badge")).toHaveText("Borrowed");
  await page.getByLabel("Quantity being returned 1", { exact: true }).fill("6");
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText(
    "Partially Returned",
  );
  expect(
    (await (await page.request.get(`/api/borrowing/${borrowId}`)).json())
      .quantityOutstanding,
  ).toBe(6);
  await page.getByLabel("Quantity being returned 1", { exact: true }).fill("4");
  await page.getByLabel("Quantity being returned 2", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Returned");
  expect(
    (await (await page.request.get(`/api/inventory/${first.id}`)).json())
      .availableQuantity,
  ).toBe(20);
  await expect(
    page.getByRole("heading", { name: "Transaction timeline", exact: true }),
  ).toBeVisible();
  await page.goto("/borrowing-history");
  await page
    .getByLabel("Search transaction, borrower, ID or item", { exact: true })
    .fill(id);
  await page
    .getByLabel("Borrow status", { exact: true })
    .selectOption("RETURNED");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  await page.goto("/reports");
  await page
    .getByLabel("Report type", { exact: true })
    .selectOption("borrowing-history");
  await page
    .getByLabel("Search item / borrower / transaction", { exact: true })
    .fill(id);
  await page
    .getByRole("button", { name: "Generate report", exact: true })
    .click();
  await expect(page.locator(".report-sheet")).toContainText(name);
  for (const kind of ["CSV", "PDF"]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: kind, exact: true }).click();
    const downloaded = await downloadPromise;
    const path = await downloaded.path();
    expect(path).toBeTruthy();
    const file = await readFile(path!);
    if (kind === "PDF") expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    else expect(file.toString()).toContain(id);
  }
});
test("damaged and lost returns create borrower-linked incidents and clear overdue loans", async ({
  page,
}) => {
  const item = await fixture(page),
    b = await loan(page, item.id, 5);
  await page.goto(`/borrowing/${b.id}`);
  await page.getByLabel("Quantity being returned 1", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Add return line", exact: true })
    .click();
  await page.getByLabel("Quantity being returned 2", { exact: true }).fill("1");
  await page
    .getByLabel("Condition upon return 2", { exact: true })
    .selectOption("DAMAGED");
  await page
    .getByLabel("Damage / loss description 2", { exact: true })
    .fill("Chipped during use");
  await page
    .getByLabel("Action required 2", { exact: true })
    .fill("Assessment and repair");
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Returned");
  expect(
    (await (await page.request.get(`/api/inventory/${item.id}`)).json())
      .availableQuantity,
  ).toBe(19);
  await page.goto("/damaged");
  await expect(
    page.getByRole("row").filter({ hasText: item.name }),
  ).toContainText(b.borrowerName);
  const lostItem = await fixture(page),
    overdue = await loan(page, lostItem.id, 2, true);
  await page.goto("/dashboard");
  const attention = page
    .getByRole("row")
    .filter({ hasText: overdue.transactionNumber });
  await expect(attention).toContainText("Overdue");
  await page.goto("/return-items");
  await page
    .getByLabel("Search transaction, borrower, ID or item", { exact: true })
    .fill(overdue.borrowerName);
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: overdue.transactionNumber })
    .getByRole("link", { name: "Record return", exact: true })
    .click();
  await page.getByLabel("Quantity being returned 1", { exact: true }).fill("2");
  await page
    .getByLabel("Condition upon return 1", { exact: true })
    .selectOption("LOST_MISSING");
  await page
    .getByLabel("Damage / loss description 1", { exact: true })
    .fill("Borrower reported item missing");
  await page
    .getByRole("button", { name: "Record return", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Returned");
  const current = await (
    await page.request.get(`/api/inventory/${lostItem.id}`)
  ).json();
  expect([current.availableQuantity, current.borrowedQuantity]).toEqual([
    18, 0,
  ]);
  await page.goto("/lost");
  await expect(
    page.getByRole("row").filter({ hasText: lostItem.name }),
  ).toContainText(overdue.borrowerName);
});
test("cancels an unreleased loan and rejects unauthorized and invalid borrowing APIs", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/borrowing")).status()).toBe(401);
  for (const route of ["borrow-items", "return-items", "borrowing-history"])
    expect((await request.get(`/${route}`, { maxRedirects: 0 })).status()).toBe(
      307,
    );
  const i = await fixture(page),
    b = await loan(page, i.id, 3);
  await page.goto(`/borrowing/${b.id}`);
  await page
    .getByRole("button", { name: "Cancel borrowing", exact: true })
    .click();
  await page
    .getByLabel("Cancellation reason", { exact: false })
    .fill("Release did not take place");
  await page
    .getByRole("button", { name: "Confirm cancellation", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Cancelled");
  expect(
    (await (await page.request.get(`/api/inventory/${i.id}`)).json())
      .availableQuantity,
  ).toBe(20);
  expect(
    (
      await page.request.post("/api/borrowing", {
        headers: { Origin: origin },
        data: {
          borrowerName: "Invalid",
          borrowerType: "STUDENT",
          purpose: "Invalid request",
          borrowedDate: today,
          expectedReturnDate: today,
          items: [],
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await page.request.get("/api/borrowing?status=invalid")).status(),
  ).toBe(400);
});
