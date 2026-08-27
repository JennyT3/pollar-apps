import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Where the database lives.
 *
 * Unset (a fresh clone) means a local SQLite file, so `pnpm install && pnpm
 * dev` works with nothing configured but the Pollar key, which the bounty
 * requires. A deploy points DATABASE_URL at a libSQL/Turso database instead,
 * because a serverless filesystem is ephemeral and read-only.
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/polla.db";
export const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;

/** A local file DB is migrated on boot; a remote one is migrated on deploy. */
export const IS_LOCAL_FILE_DB = DATABASE_URL.startsWith("file:");

/**
 * libSQL will open a `file:` URL but will not create the directory holding it,
 * and a missing directory surfaces as a bare "code 14". Both the app and
 * drizzle-kit call this before connecting.
 */
export function ensureLocalDbDir(): void {
  if (!IS_LOCAL_FILE_DB) return;
  mkdirSync(dirname(DATABASE_URL.replace(/^file:/, "")), { recursive: true });
}
