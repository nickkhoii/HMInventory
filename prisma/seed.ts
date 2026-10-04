import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
const prisma = new PrismaClient();
async function main() {
  const username = (process.env.ADMIN_USERNAME || "administrator").trim(),
    name = (process.env.ADMIN_NAME || "Laboratory Administrator").trim(),
    password = process.env.ADMIN_INITIAL_PASSWORD;
  const existing = await prisma.admin.findUnique({ where: { id: 1 } });
  if (
    !existing &&
    (username.trim().length < 3 ||
      username.length > 80 ||
      !name.trim() ||
      name.length > 160)
  )
    throw new Error(
      "Initial administrator username must be 3–80 characters and name 1–160 characters",
    );
  if (
    !existing &&
    (!password ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72)
  )
    throw new Error(
      "Set ADMIN_INITIAL_PASSWORD to a unique password of at least 12 characters and at most 72 UTF-8 bytes",
    );
  const passwordHash = existing?.passwordHash ?? (await hash(password!, 12));
  await prisma.$transaction(
    async (tx) => {
      await tx.admin.upsert({
        where: { id: 1 },
        create: { id: 1, username, name, passwordHash },
        update: {},
      });
      await tx.settings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });
      const categories = [
        "Kitchen Appliances",
        "Kitchen Equipment",
        "Cooking Tools",
        "Baking Tools",
        "Utensils",
        "Glassware",
        "Tableware",
        "Cutlery",
        "Cookware",
        "Furniture",
        "Linens",
        "Cleaning Equipment",
        "Cleaning Supplies",
        "Consumable Supplies",
        "Electrical Equipment",
        "Other Equipment",
      ];
      for (const category of categories)
        await tx.category.upsert({
          where: { name: category },
          create: {
            name: category,
            description: `Laboratory ${category.toLowerCase()}`,
          },
          update: {},
        });
      for (const location of [
        "Main Kitchen Laboratory",
        "Baking Laboratory",
        "Dining Laboratory",
        "Storage Room",
        "Preparation Area",
        "Washing Area",
        "Equipment Room",
      ])
        await tx.location.upsert({
          where: { name: location },
          create: { name: location },
          update: {},
        });
      if (process.env.SEED_SAMPLE_DATA === "true") {
        const kitchen = await tx.location.findUniqueOrThrow({
          where: { name: "Main Kitchen Laboratory" },
        });
        const samples = [
          [
            "HM-KITCHEN-0001",
            "Commercial stand mixer",
            "Kitchen Appliances",
            3,
            1,
            18000,
          ],
          ["HM-COOK-0002", "Stainless steel saucepan", "Cookware", 24, 5, 850],
          ["HM-UTENSIL-0003", "Silicone spatula", "Utensils", 4, 5, 120],
          ["HM-GLASS-0004", "Water goblet", "Glassware", 48, 12, 95],
          ["HM-BAKE-0005", "Digital kitchen scale", "Baking Tools", 6, 2, 650],
          [
            "HM-SUPPLY-0006",
            "Disposable piping bags",
            "Consumable Supplies",
            0,
            10,
            8,
          ],
        ] as const;
        for (const [
          inventoryCode,
          itemName,
          categoryName,
          quantity,
          minimumStock,
          unitCost,
        ] of samples) {
          if (await tx.inventoryItem.findUnique({ where: { inventoryCode } }))
            continue;
          const category = await tx.category.findUniqueOrThrow({
            where: { name: categoryName },
          });
          const dateAcquired = new Date();
          const item = await tx.inventoryItem.create({
            data: {
              inventoryCode,
              name: itemName,
              categoryId: category.id,
              locationId: kitchen.id,
              quantity,
              availableQuantity: quantity,
              minimumStock,
              unitCost,
              dateAcquired,
              condition: "GOOD",
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              itemId: item.id,
              transactionNumber: `HM-SEED-${randomUUID()}`,
              type: "INITIAL",
              quantity,
              previousQuantity: 0,
              newQuantity: quantity,
              previousAvailable: 0,
              newAvailable: quantity,
              unitCost,
              transactionDate: dateAcquired,
              remarks: "Sample inventory initialization",
            },
          });
          await tx.conditionHistory.create({
            data: {
              itemId: item.id,
              current: "GOOD",
              reason: "Sample initialization",
            },
          });
        }
      }
      await tx.activityLog.create({
        data: {
          action: "System initialized",
          description:
            "Single administrator, categories and laboratory locations initialized",
        },
      });
    },
    { timeout: 30000 },
  );
  console.log(
    "Initialization complete. Sign in and change the initial password in Settings. Existing credentials were not overwritten.",
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
