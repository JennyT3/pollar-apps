import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";

/**
 * SQLite via libsql. Defaults to a local file so `pnpm dev` works with
 * nothing but the Pollar API key in `.env` (see README "Database setup").
 * For a serverless production deploy (Vercel), point DATABASE_URL at a
 * hosted libsql database (e.g. Turso, `libsql://…`) with DATABASE_AUTH_TOKEN
 * set — same client, same schema, no code changes.
 */
const globalDb = globalThis as { __alcanciaDb?: Client };

function getClient(): Client {
  const url = process.env.DATABASE_URL ?? "file:./data/alcancia.db";
  if (url.startsWith("file:")) {
    // Fresh clones don't have ./data yet, and libsql won't create it for us.
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }
  globalDb.__alcanciaDb ??= createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return globalDb.__alcanciaDb;
}

let migrated = false;

/** Runs the schema on first use. Idempotent, safe to call on every request. */
export async function db(): Promise<Client> {
  const client = getClient();
  if (!migrated) {
    migrated = true;
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL DEFAULT '🐷',
        target_amount TEXT NOT NULL,
        deadline TEXT,
        mode TEXT NOT NULL CHECK (mode IN ('personal','shared')),
        currency TEXT NOT NULL DEFAULT 'USDC',
        owner_address TEXT NOT NULL,
        keeper_address TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS set_asides (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id),
        owner_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS contributions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id),
        contributor_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        tx_hash TEXT NOT NULL UNIQUE,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS members (
        goal_id TEXT NOT NULL REFERENCES goals(id),
        address TEXT NOT NULL,
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (goal_id, address)
      );

      CREATE INDEX IF NOT EXISTS idx_set_asides_goal ON set_asides(goal_id);
      CREATE INDEX IF NOT EXISTS idx_set_asides_owner ON set_asides(owner_address);
      CREATE INDEX IF NOT EXISTS idx_contributions_goal ON contributions(goal_id);
      CREATE INDEX IF NOT EXISTS idx_members_address ON members(address);
    `);
  }
  return client;
}
