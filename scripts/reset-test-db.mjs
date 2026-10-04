import { Client } from "pg";
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("Set DATABASE_URL to the isolated test database");
const url = new URL(connectionString);
if (
  url.pathname !== "/hm_inventory_test" ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55432"
)
  throw new Error(
    "Reset is restricted to the local hm_inventory_test database on port 55432",
  );
url.pathname = "/postgres";
const client = new Client({ connectionString: url.toString() });
await client.connect();
await client.query("DROP DATABASE IF EXISTS hm_inventory_test");
await client.query(
  "CREATE DATABASE hm_inventory_test TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
);
await client.end();
console.log("Isolated test database recreated with UTF8 encoding.");
