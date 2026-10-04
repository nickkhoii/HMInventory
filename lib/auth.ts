import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { compare } from "bcryptjs";
import { db } from "./db";
import { AppError } from "./errors";
import { allowedOrigin } from "./origin";
export const SESSION_COOKIE = "hm_session";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function requireAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new AppError("Please sign in", 401);
  const session = await db.session.findUnique({
    where: { id: tokenHash(token) },
    include: { admin: true },
  });
  if (!session || session.expiresAt <= new Date() || session.adminId !== 1)
    throw new AppError("Session expired. Please sign in", 401);
  return session.admin;
}
export async function checkOrigin() {
  const h = await headers();
  const configured = process.env.APP_ORIGIN;
  if (!configured) throw new AppError("APP_ORIGIN is not configured", 503);
  if (
    !allowedOrigin(
      h.get("origin"),
      configured,
      process.env.NODE_ENV === "development",
    )
  )
    throw new AppError("Invalid request origin", 403);
}
export async function login(
  username: string,
  password: string,
  remember: boolean,
) {
  // A global single-account limit also works behind proxies without trusting spoofable IP headers.
  const now = new Date();
  const allowed = await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "LoginAttempt" ("key","count","resetAt") VALUES ('administrator',0,${new Date(now.getTime() + 15 * 60 * 1000)}) ON CONFLICT ("key") DO NOTHING`;
    await tx.$queryRaw`SELECT "key" FROM "LoginAttempt" WHERE "key"='administrator' FOR UPDATE`;
    const attempt = await tx.loginAttempt.findUniqueOrThrow({
      where: { key: "administrator" },
    });
    const count = attempt.resetAt <= now ? 0 : attempt.count;
    if (count >= 10) return false;
    await tx.loginAttempt.update({
      where: { key: "administrator" },
      data: {
        count: count + 1,
        ...(attempt.resetAt <= now
          ? { resetAt: new Date(now.getTime() + 15 * 60 * 1000) }
          : {}),
      },
    });
    return true;
  });
  if (!allowed)
    throw new AppError("Too many login attempts. Try again in 15 minutes", 429);
  const admin = await db.admin.findUnique({ where: { id: 1 } });
  // Always perform a password hash comparison, including unknown usernames.
  const valid = await compare(
    password,
    admin?.passwordHash ??
      "$2b$12$XoRErxmAThJLzNcEsKaNZuVuN8FAiXwvfRHv0Mx66VqUGcqJq3OLq",
  );
  if (!admin || !valid || username !== admin.username) {
    await db.activityLog.create({
      data: {
        action: "Invalid login",
        description: "An administrator login attempt was rejected",
      },
    });
    throw new AppError("Invalid username or password", 401);
  }
  const token = randomBytes(32).toString("hex");
  const lifetime = remember ? 30 * 86400 : 8 * 3600;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Admin" WHERE "id"=1 FOR UPDATE`;
    const current = await tx.admin.findUniqueOrThrow({ where: { id: 1 } });
    if (
      current.passwordHash !== admin.passwordHash ||
      current.username !== username
    )
      throw new AppError("Credentials changed. Please sign in again", 401);
    await tx.session.create({
      data: {
        id: tokenHash(token),
        adminId: 1,
        expiresAt: new Date(now.getTime() + lifetime * 1000),
      },
    });
    await tx.activityLog.create({
      data: { action: "Login", description: "Administrator signed in" },
    });
    await tx.session.deleteMany({ where: { expiresAt: { lt: now } } });
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: lifetime } : {}),
  });
  return { name: admin.name };
}
export async function logout() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token)
    await db.$transaction(async (tx) => {
      const removed = await tx.session.deleteMany({
        where: { id: tokenHash(token) },
      });
      if (removed.count)
        await tx.activityLog.create({
          data: { action: "Logout", description: "Administrator signed out" },
        });
    });
  (await cookies()).delete(SESSION_COOKIE);
}
