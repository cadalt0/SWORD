// Applies db/schema.sql to the database in DATABASE_URL. Safe to run more than once.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const envFile = fileURLToPath(new URL("../.env.local", import.meta.url));
if (!existsSync(envFile)) {
  console.error("web/.env.local is missing. Create it from web/.env.example and set DATABASE_URL, then run this again.");
  process.exit(1);
}
process.loadEnvFile(envFile);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in web/.env.local.");
  process.exit(1);
}

const sql = await readFile(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query(sql);
  console.log("Schema applied.");
} finally {
  await client.end();
}
