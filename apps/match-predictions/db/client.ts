import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import {
  DATABASE_AUTH_TOKEN,
  DATABASE_URL,
  ensureLocalDbDir,
  IS_LOCAL_FILE_DB,
} from "./url";

/**
 * One database handle per process, kept on globalThis so Next's dev hot
 * reload doesn't open a fresh connection on every edit.
 */
const globalDb = globalThis as {
  __pollaDb?: ReturnType<typeof drizzle<typeof schema>>;
  __pollaDbReady?: Promise<void>;
};

function create() {
  ensureLocalDbDir();
  const client = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = (globalDb.__pollaDb ??= create());

/**
 * Applies pending migrations. Awaited by everything that touches the database,
 * so a fresh clone needs no setup step: the file and its tables appear on the
 * first request.
 *
 * A remote database is migrated at deploy time (`pnpm db:migrate`) instead, because
 * running migrations from inside a serverless request would race across
 * instances.
 */
export function dbReady(): Promise<void> {
  if (!IS_LOCAL_FILE_DB) return Promise.resolve();

  // Checked here rather than at import time: `next build` also runs with
  // NODE_ENV=production, and the database is a runtime concern.
  if (process.env.NODE_ENV === "production") {
    return Promise.reject(
      new Error(
        "DATABASE_URL is not set, so the app fell back to a local SQLite file, " +
          "which cannot work in production, where the filesystem is read-only. " +
          "Set DATABASE_URL (and DATABASE_AUTH_TOKEN) to a libSQL/Turso database."
      )
    );
  }

  return (globalDb.__pollaDbReady ??= migrate(db, {
    migrationsFolder: "./db/migrations",
  }));
}

export { schema };
