import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { assertTestDatabase } from "../../lib/test-database";
export default async function setup() {
  assertTestDatabase(process.env.DATABASE_URL);
  execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
    stdio: "pipe",
    env: process.env,
  });
  const db = new PrismaClient();
  await db.loginAttempt.deleteMany();
  await db.$disconnect();
}
