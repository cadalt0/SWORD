import pg from "pg";

import { config } from "./config.js";

/// One connection pool for the server. Local databases run without TLS; hosted ones require it.
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(config.databaseUrl);

export const db = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: local ? undefined : { rejectUnauthorized: true },
  max: 10,
});
