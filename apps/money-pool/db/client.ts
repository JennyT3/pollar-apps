import { drizzle as drizzleNeon, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

let dbInstance: NeonHttpDatabase<typeof schema> | ReturnType<typeof drizzleLibSQL>;

if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  dbInstance = drizzleNeon({ client: sql, schema });
} else {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const client = createClient({ url: 'file:data/local.db' });

  client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      goal_amount TEXT NOT NULL,
      deadline INTEGER,
      organizer_address TEXT NOT NULL,
      organizer_user_id TEXT NOT NULL,
      status TEXT DEFAULT 'open' NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      pool_id TEXT NOT NULL REFERENCES pools(id),
      contributor_name TEXT,
      contributor_address TEXT,
      amount TEXT NOT NULL,
      tx_hash TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      over_goal INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL
    );
  `).catch(console.error);

  dbInstance = drizzleLibSQL({ client, schema });
}

export const db = dbInstance as NeonHttpDatabase<typeof schema>;
