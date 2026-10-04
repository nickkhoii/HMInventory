export function assertTestDatabase(value: string | undefined) {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(
      "Set DATABASE_URL to the dedicated hm_inventory_test database",
    );
  }
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    url.pathname !== "/hm_inventory_test"
  )
    throw new Error("Tests require the dedicated hm_inventory_test database");
  return value!;
}
