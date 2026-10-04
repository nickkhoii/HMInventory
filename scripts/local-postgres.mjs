import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const databaseDir = resolve(".local-db");
const server = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "local-development-only",
  port: 55432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => console.error(String(message)),
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await server.initialise();
await server.start();
const client = server.getPgClient();
await client.connect();
if (
  !(
    await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'hm_inventory'",
    )
  ).rowCount
)
  await client.query(
    "CREATE DATABASE hm_inventory TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
  );
if (
  !(
    await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'hm_inventory_test'",
    )
  ).rowCount
)
  await client.query(
    "CREATE DATABASE hm_inventory_test TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
  );
await client.end();
console.log(
  "Local PostgreSQL ready on 127.0.0.1:55432. Development databases: hm_inventory, hm_inventory_test. Press Ctrl+C to stop.",
);
async function stop() {
  await server.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
