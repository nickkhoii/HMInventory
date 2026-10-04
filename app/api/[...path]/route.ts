import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  checkOrigin,
  login,
  logout,
  requireAdmin,
  SESSION_COOKIE,
  tokenHash,
} from "@/lib/auth";
import { loginSchema, lookupSchema, settingsSchema } from "@/lib/validation";
import {
  archiveItem,
  saveItem,
  recordMovement,
  lockItem,
} from "@/lib/inventory-service";
import { dashboard, listInventory } from "@/lib/queries";
import { csvCell, generateReport } from "@/lib/reports";
import { jsonObject } from "@/lib/http";
import { listTransactions, listActivity } from "@/lib/history-queries";
import { reconcileCondition } from "@/lib/condition";
import { createBorrow, recordReturn, cancelBorrow } from "@/lib/borrow-service";
import { listBorrowing, borrowDetail } from "@/lib/borrow-queries";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: NextRequest, ctx: Context) {
  try {
    const { path } = await ctx.params;
    const [resource, id] = path;
    const method = req.method;
    const resources = [
      "auth",
      "dashboard",
      "inventory",
      "categories",
      "locations",
      "options",
      "damaged",
      "lost",
      "disposal",
      "transactions",
      "activity",
      "settings",
      "reports",
      "movements",
      "borrowing",
      "returns",
    ];
    if (!resources.includes(resource)) throw new AppError("Not found", 404);
    if (
      path.length > 2 ||
      (id &&
        ![
          "inventory",
          "categories",
          "locations",
          "damaged",
          "lost",
          "auth",
          "borrowing",
        ].includes(resource))
    )
      throw new AppError("Not found", 404);
    if (
      method === "GET" &&
      id &&
      !["inventory", "borrowing"].includes(resource)
    )
      throw new AppError("Method not allowed", 405);
    if (
      ["categories", "locations"].includes(resource) &&
      ((method === "POST" && id) ||
        (method === "PATCH" && !id) ||
        (method === "GET" && id))
    )
      throw new AppError("Method not allowed", 405);
    if (method !== "GET") await checkOrigin();
    if (resource === "auth" && id === "login" && method === "POST") {
      const data = loginSchema.parse(await jsonObject(req));
      return NextResponse.json(
        await login(data.username, data.password, data.remember),
      );
    }
    if (resource === "auth" && id === "logout" && method === "POST") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    const admin = await requireAdmin();
    if (method === "GET") {
      let result: unknown;
      switch (resource) {
        case "borrowing":
          result = id
            ? await borrowDetail(id)
            : await listBorrowing(req.nextUrl.searchParams);
          break;
        case "dashboard":
          result = await dashboard();
          break;
        case "inventory":
          result = id
            ? await db.inventoryItem.findUnique({
                where: { id },
                include: {
                  category: true,
                  location: true,
                  transactions: { orderBy: { createdAt: "desc" } },
                  conditions: { orderBy: { createdAt: "desc" } },
                  damages: { select: { quantity: true, status: true } },
                  losses: { select: { quantity: true, status: true } },
                  disposals: { select: { quantity: true } },
                },
              })
            : await listInventory(req.nextUrl.searchParams);
          break;
        case "categories":
          result = await db.category.findMany({
            include: { _count: { select: { items: true } } },
            orderBy: { name: "asc" },
          });
          break;
        case "locations":
          result = await db.location.findMany({
            include: { _count: { select: { items: true } } },
            orderBy: { name: "asc" },
          });
          break;
        case "options":
          result = {
            categories: await db.category.findMany({
              orderBy: { name: "asc" },
            }),
            locations: await db.location.findMany({ orderBy: { name: "asc" } }),
            items: await db.inventoryItem.findMany({
              where: { isActive: true },
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                inventoryCode: true,
                quantity: true,
                availableQuantity: true,
                condition: true,
              },
            }),
          };
          break;
        case "damaged":
          result = await db.damageRecord.findMany({
            include: {
              item: { include: { category: true } },
              returnItem: {
                include: {
                  returnTransaction: {
                    include: {
                      borrowTransaction: {
                        select: {
                          id: true,
                          transactionNumber: true,
                          borrowerName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          });
          break;
        case "lost":
          result = await db.lostItemRecord.findMany({
            include: {
              item: true,
              returnItem: {
                include: {
                  returnTransaction: {
                    include: {
                      borrowTransaction: {
                        select: {
                          id: true,
                          transactionNumber: true,
                          borrowerName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          });
          break;
        case "disposal":
          result = await db.disposalRecord.findMany({
            include: { item: true },
            orderBy: { createdAt: "desc" },
          });
          break;
        case "transactions": {
          result = await listTransactions(req.nextUrl.searchParams);
          break;
        }
        case "activity": {
          result = await listActivity(req.nextUrl.searchParams);
          break;
        }
        case "settings":
          result = {
            name: admin.name,
            username: admin.username,
            ...(await db.settings.findUnique({ where: { id: 1 } })),
          };
          break;
        case "reports": {
          const report = await generateReport(req.nextUrl.searchParams),
            format = req.nextUrl.searchParams.get("format");
          if (format === "csv") {
            const csv = [
              [report.header],
              [report.title],
              [report.generatedAt],
              [report.filters],
              report.columns,
              ...report.rows,
              ["Total quantity", report.totalQuantity],
              ...(report.totalValue !== null
                ? [["Total value", report.totalValue]]
                : []),
            ]
              .map((r) => r.map(csvCell).join(","))
              .join("\r\n");
            return new NextResponse("\uFEFF" + csv, {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="hm-report.csv"',
                "Cache-Control": "no-store",
              },
            });
          }
          if (format === "pdf") {
            const { jsPDF } = await import("jspdf");
            const { default: autoTable } = await import("jspdf-autotable");
            const doc = new jsPDF({ orientation: "landscape" });
            doc.setFontSize(16);
            const headerLines = doc.splitTextToSize(report.header, 265);
            doc.text(headerLines, 14, 15);
            const offset = (headerLines.length - 1) * 6;
            doc.setFontSize(10);
            const institutionLines = doc.splitTextToSize(
              `${report.institution} | ${report.laboratory}`,
              265,
            );
            doc.text(institutionLines, 14, 23 + offset);
            const subOffset = offset + (institutionLines.length - 1) * 4;
            doc.text(
              `${report.title} | Generated ${report.generatedAt}`,
              14,
              30 + subOffset,
            );
            const lines = doc.splitTextToSize(report.filters, 265);
            doc.text(lines, 14, 37 + subOffset);
            autoTable(doc, {
              head: [report.columns],
              body: report.rows,
              startY: 40 + subOffset + lines.length * 4,
              styles: { fontSize: 8 },
              margin: { bottom: 18 },
            });
            let totalsY =
              ((doc as unknown as { lastAutoTable?: { finalY: number } })
                .lastAutoTable?.finalY ?? 50) + 12;
            if (totalsY > 185) {
              doc.addPage();
              totalsY = 20;
            }
            doc.text(
              `Totals: ${report.rows.length} records; quantity ${report.totalQuantity}${report.totalValue !== null ? `; value PHP ${report.totalValue}` : ""}`,
              14,
              totalsY,
            );
            const pages = doc.getNumberOfPages();
            for (let page = 1; page <= pages; page++) {
              doc.setPage(page);
              doc.setFontSize(8);
              doc.text(`Page ${page} of ${pages}`, 260, 202);
            }
            return new NextResponse(new Uint8Array(doc.output("arraybuffer")), {
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="hm-report.pdf"',
                "Cache-Control": "no-store",
              },
            });
          }
          result = report;
          break;
        }
        default:
          throw new AppError("Not found", 404);
      }
      if (result === null) throw new AppError("Not found", 404);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const body = await jsonObject(req);
    let result: unknown;
    if (resource === "borrowing") {
      if (method === "POST" && !id) result = await createBorrow(body);
      else if (method === "PATCH" && id) result = await cancelBorrow(id, body);
      else throw new AppError("Method not allowed", 405);
    } else if (resource === "returns" && method === "POST")
      result = await recordReturn(body);
    else if (resource === "inventory") {
      if (method === "POST" && !id) result = await saveItem(body);
      else if (method === "PATCH" && id)
        result =
          body.action === "archive" || body.action === "restore"
            ? await archiveItem(id, body.action === "restore")
            : await saveItem(body, id);
      else throw new AppError("Method not allowed", 405);
    } else if (resource === "movements" && method === "POST")
      result = await recordMovement(body);
    else if (
      ["categories", "locations"].includes(resource) &&
      ["POST", "PATCH"].includes(method)
    ) {
      result = await db.$transaction(async (tx) => {
        let data;
        if (id && (body.action === "archive" || body.action === "restore"))
          data = { isActive: body.action === "restore" };
        else data = lookupSchema.parse(body);
        const saved =
          resource === "categories"
            ? id
              ? await tx.category.update({ where: { id }, data })
              : await tx.category.create({ data: lookupSchema.parse(body) })
            : id
              ? await tx.location.update({ where: { id }, data })
              : await tx.location.create({ data: lookupSchema.parse(body) });
        await tx.activityLog.create({
          data: {
            action: `${id ? "Updated" : "Added"} ${resource}`,
            description: saved.name,
          },
        });
        return saved;
      });
    } else if (
      ["damaged", "lost"].includes(resource) &&
      id &&
      method === "PATCH"
    ) {
      result = await db.$transaction(async (tx) => {
        if (resource === "damaged") {
          const input = z
            .object({
              status: z.enum(["FOR_ASSESSMENT", "FOR_REPAIR", "BEYOND_REPAIR"]),
              actionTaken: z.string().trim().max(2000),
            })
            .parse(body);
          const record = await tx.damageRecord.findUniqueOrThrow({
            where: { id },
          });
          const item = await lockItem(tx, record.itemId);
          if (!item.isActive)
            throw new AppError(
              "Restore inventory before updating an unresolved incident",
            );
          const current = await tx.damageRecord.findUniqueOrThrow({
            where: { id },
          });
          if (["REPAIRED", "DISPOSED"].includes(current.status))
            throw new AppError("Record already resolved");
          const saved = await tx.damageRecord.update({
            where: { id },
            data: input,
          });
          await reconcileCondition(
            tx,
            item,
            `Damage status changed to ${input.status}: ${input.actionTaken}`,
          );
          await tx.activityLog.create({
            data: {
              action: "Damage status updated",
              description: `${id}: ${input.status} ${input.actionTaken}`,
            },
          });
          return saved;
        }
        const input = z
          .object({
            status: z.enum(["MISSING", "UNDER_INVESTIGATION", "DECLARED_LOST"]),
            remarks: z.string().trim().max(2000),
          })
          .parse(body);
        const record = await tx.lostItemRecord.findUniqueOrThrow({
          where: { id },
        });
        const item = await lockItem(tx, record.itemId);
        if (!item.isActive)
          throw new AppError(
            "Restore inventory before updating an unresolved incident",
          );
        const current = await tx.lostItemRecord.findUniqueOrThrow({
          where: { id },
        });
        if (current.status === "RECOVERED")
          throw new AppError("Record already recovered");
        const saved = await tx.lostItemRecord.update({
          where: { id },
          data: input,
        });
        await tx.activityLog.create({
          data: {
            action: "Lost status updated",
            description: `${id}: ${input.status} ${input.remarks}`,
          },
        });
        return saved;
      });
    } else if (resource === "settings" && method === "PATCH") {
      const input = settingsSchema.parse(body);
      if (!(await compare(input.currentPassword, admin.passwordHash)))
        throw new AppError("Current password is incorrect");
      const passwordHash = input.newPassword
        ? await hash(input.newPassword, 12)
        : undefined;
      result = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Admin" WHERE "id"=1 FOR UPDATE`;
        const current = await tx.admin.findUniqueOrThrow({ where: { id: 1 } });
        if (current.passwordHash !== admin.passwordHash)
          throw new AppError(
            "Credentials changed. Please reload and try again",
            409,
          );
        await tx.admin.update({
          where: { id: 1 },
          data: { name: input.name, username: input.username, passwordHash },
        });
        const saved = await tx.settings.upsert({
          where: { id: 1 },
          create: {
            institutionName: input.institutionName,
            laboratoryName: input.laboratoryName,
            reportHeader: input.reportHeader,
          },
          update: {
            institutionName: input.institutionName,
            laboratoryName: input.laboratoryName,
            reportHeader: input.reportHeader,
          },
        });
        const token = req.cookies.get(SESSION_COOKIE)?.value;
        if (passwordHash)
          await tx.session.deleteMany({
            where: { id: { not: token ? tokenHash(token) : "" } },
          });
        await tx.activityLog.create({
          data: {
            action: passwordHash ? "Changed Password" : "Updated Settings",
            description:
              "Administrator profile and laboratory settings updated",
          },
        });
        return saved;
      });
    } else throw new AppError("Method not allowed", 405);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return NextResponse.json(
          { error: "This code or name already exists" },
          { status: 409 },
        );
      if (error.code === "P2025")
        return NextResponse.json(
          { error: "Record not found" },
          { status: 404 },
        );
      if (error.code === "P2003")
        return NextResponse.json(
          { error: "Invalid category or location" },
          { status: 400 },
        );
    }
    console.error(
      "API request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "Unable to complete the request. Check database connectivity and try again.",
      },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
