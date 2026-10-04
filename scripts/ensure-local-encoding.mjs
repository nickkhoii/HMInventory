import "dotenv/config";
import { Client } from "pg";
const url = new URL(process.env.DATABASE_URL);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55432" ||
  url.pathname !== "/hm_inventory"
)
  throw new Error("This helper only repairs the local development database");
let client = new Client({ connectionString: url.toString() });
await client.connect();
const encoding = (await client.query("SHOW server_encoding")).rows[0]
  .server_encoding;
if (encoding === "UTF8") {
  await client.end();
  console.log("Local database uses UTF8.");
  process.exit(0);
}
const tables = (
  await client.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'",
  )
).rows[0].count;
if (tables > 0) {
  await client.end();
  throw new Error(
    "Existing database contains tables. Refusing to replace it; migrate its data to a UTF8 database manually.",
  );
}
await client.end();
url.pathname = "/postgres";
client = new Client({ connectionString: url.toString() });
await client.connect();
await client.query("DROP DATABASE hm_inventory");
await client.query(
  "CREATE DATABASE hm_inventory TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
);
await client.end();
console.log("Empty local development database recreated with UTF8 encoding.");
