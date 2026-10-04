import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; no changes made.");
  process.exit(0);
}
const password = randomBytes(24).toString("base64url");
writeFileSync(
  ".env",
  `DATABASE_URL="postgresql://postgres:local-development-only@127.0.0.1:55432/hm_inventory"\nDIRECT_URL="postgresql://postgres:local-development-only@127.0.0.1:55432/hm_inventory"\nAPP_ORIGIN="http://localhost:3000"\nADMIN_USERNAME="administrator"\nADMIN_NAME="Laboratory Administrator"\nADMIN_INITIAL_PASSWORD="${password}"\nSEED_SAMPLE_DATA="true"\n`,
  { mode: 0o600 },
);
console.log(
  "Created ignored .env with a randomly generated administrator password. Read ADMIN_INITIAL_PASSWORD locally to sign in, then change it in Settings.",
);
