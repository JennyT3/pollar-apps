import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

let client: Client | null = null;
let migrated = false;

function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "pasanaku.db")}`;
}

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: databaseUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function migrate(): Promise<Client> {
  const db = getDb();
  if (migrated) return db;

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS circles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      amount TEXT NOT NULL,
      frequency TEXT NOT NULL,
      organizer_address TEXT NOT NULL,
      admin_token_hash TEXT NOT NULL,
      current_round INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER NOT NULL,
      address TEXT NOT NULL,
      turn_index INTEGER NOT NULL,
      joined_at INTEGER NOT NULL,
      UNIQUE(circle_id, address)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circle_id INTEGER NOT NULL,
      round INTEGER NOT NULL,
      payer TEXT NOT NULL,
      recipient TEXT NOT NULL,
      amount TEXT NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      memo_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  migrated = true;
  return db;
}
