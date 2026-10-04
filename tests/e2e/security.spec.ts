import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import "dotenv/config";
import { assertTestDatabase } from "../../lib/test-database";
const username = process.env.ADMIN_USERNAME || "administrator",
  password = process.env.ADMIN_INITIAL_PASSWORD!,
  origin = "http://localhost:3000";
const db = new PrismaClient();
test.beforeEach(async () => {
  assertTestDatabase(process.env.DATABASE_URL);
  await db.loginAttempt.deleteMany();
});
test.afterAll(() => db.$disconnect());
test("password changes revoke other sessions and expired sessions cannot read inventory", async ({
  playwright,
}) => {
  const first = await playwright.request.newContext({ baseURL: origin }),
    second = await playwright.request.newContext({ baseURL: origin });
  expect(
    (
      await first.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { username, password },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await second.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { username, password },
      })
    ).status(),
  ).toBe(200);
  const settings = await (await first.get("/api/settings")).json();
  const newPassword = randomBytes(24).toString("base64url");
  expect(
    (
      await first.patch("/api/settings", {
        headers: { Origin: origin },
        data: { ...settings, currentPassword: "incorrect-password" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await first.patch("/api/settings", {
        headers: { Origin: origin },
        data: { ...settings, currentPassword: password, newPassword },
      })
    ).status(),
  ).toBe(200);
  expect((await second.get("/api/inventory")).status()).toBe(401);
  expect(
    (
      await second.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { username, password },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await second.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { username, password: newPassword },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await first.patch("/api/settings", {
        headers: { Origin: origin },
        data: {
          ...settings,
          currentPassword: newPassword,
          newPassword: password,
        },
      })
    ).status(),
  ).toBe(200);
  const cookie = (await first.storageState()).cookies.find(
    (c) => c.name === "hm_session",
  )!;
  const digest = createHash("sha256").update(cookie.value).digest("hex");
  await db.session.update({
    where: { id: digest },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  expect((await first.get("/api/inventory")).status()).toBe(401);
  await first.dispose();
  await second.dispose();
});
test("login limit is persisted in PostgreSQL", async ({ request }) => {
  for (let i = 0; i < 10; i++)
    expect(
      (
        await request.post("/api/auth/login", {
          headers: { Origin: origin },
          data: { username, password: "wrong-password" },
        })
      ).status(),
    ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { username, password },
      })
    ).status(),
  ).toBe(429);
  expect(
    (
      await db.loginAttempt.findUniqueOrThrow({
        where: { key: "administrator" },
      })
    ).count,
  ).toBe(10);
  await db.loginAttempt.deleteMany();
});
