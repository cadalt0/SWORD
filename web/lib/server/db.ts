import "server-only";

import pg from "pg";

import { env } from "./env";

/// One connection pool for the whole server. Created on first use.
let pool: pg.Pool | undefined;

export function db(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.databaseUrl, ssl: { rejectUnauthorized: true } });
  }
  return pool;
}
