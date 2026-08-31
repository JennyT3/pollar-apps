import { createClient, type Client, type Row } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import type { Split, SplitParticipant } from "@/lib/split";

/**
 * Local-file SQLite (via libSQL, the same dialect Turso speaks) — the
 * fresh-clone default whenever `DATABASE_URL` isn't set, so `pnpm install
 * && pnpm dev` works with only the Pollar key in `.env`, no external
 * database account needed. File lives at `data/bill-split.db`, created on
 * first request, gitignored.
 */
const DB_PATH = "file:./data/bill-split.db";

const globalDb = globalThis as { __billSplitDb?: Client; __billSplitReady?: Promise<void> };

function getClient(): Client {
  if (!globalDb.__billSplitDb) {
    fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    globalDb.__billSplitDb = createClient({ url: DB_PATH });
  }
  return globalDb.__billSplitDb;
}

async function ready(): Promise<Client> {
  const db = getClient();
  globalDb.__billSplitReady ??= db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY,
      short_ref TEXT NOT NULL,
      description TEXT NOT NULL,
      total_amount TEXT NOT NULL,
      asset_code TEXT NOT NULL,
      asset_issuer TEXT NOT NULL,
      collector_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS split_participants (
      id TEXT PRIMARY KEY,
      split_id TEXT NOT NULL REFERENCES splits(id),
      label TEXT NOT NULL,
      share_amount TEXT NOT NULL,
      payer_address TEXT,
      tx_hash TEXT,
      paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_participants_split_id ON split_participants(split_id);
    CREATE INDEX IF NOT EXISTS idx_splits_collector ON splits(collector_address);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_tx_hash
    ON split_participants(tx_hash) WHERE tx_hash IS NOT NULL;
  `);
  await globalDb.__billSplitReady;
  return db;
}

function toParticipant(row: Row): SplitParticipant {
  return {
    id: row.id as string,
    splitId: row.split_id as string,
    label: row.label as string,
    shareAmount: row.share_amount as string,
    payerAddress: (row.payer_address as string | null) ?? null,
    txHash: (row.tx_hash as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
  };
}

function toSplit(row: Row, participants: SplitParticipant[]): Split {
  return {
    id: row.id as string,
    shortRef: row.short_ref as string,
    description: row.description as string,
    totalAmount: row.total_amount as string,
    assetCode: row.asset_code as string,
    assetIssuer: row.asset_issuer as string,
    collectorAddress: row.collector_address as string,
    status: row.status === "closed" ? "closed" : "open",
    createdAt: row.created_at as string,
    participants,
  };
}

async function fetchParticipants(db: Client, splitId: string): Promise<SplitParticipant[]> {
  const result = await db.execute({
    sql: `SELECT * FROM split_participants WHERE split_id = ? ORDER BY rowid`,
    args: [splitId],
  });
  return result.rows.map(toParticipant);
}

async function createSplit(input: {
  description: string;
  totalAmount: string;
  assetCode: string;
  assetIssuer: string;
  collectorAddress: string;
  participants: { label: string; shareAmount: string }[];
}): Promise<Split> {
  const db = await ready();
  const id = crypto.randomUUID();
  const shortRef = id.replace(/-/g, "").slice(0, 8);
  const createdAt = new Date().toISOString();
  const participants: SplitParticipant[] = input.participants.map((p) => ({
    id: crypto.randomUUID(),
    splitId: id,
    label: p.label,
    shareAmount: p.shareAmount,
    payerAddress: null,
    txHash: null,
    paidAt: null,
  }));

  // One batch, all-or-nothing: a split is never left half-created if an
  // insert partway through fails.
  await db.batch(
    [
      {
        sql: `INSERT INTO splits (id, short_ref, description, total_amount, asset_code, asset_issuer, collector_address, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
        args: [
          id,
          shortRef,
          input.description,
          input.totalAmount,
          input.assetCode,
          input.assetIssuer,
          input.collectorAddress,
          createdAt,
        ],
      },
      ...participants.map((p) => ({
        sql: `INSERT INTO split_participants (id, split_id, label, share_amount) VALUES (?, ?, ?, ?)`,
        args: [p.id, id, p.label, p.shareAmount],
      })),
    ],
    "write"
  );

  return {
    id,
    shortRef,
    description: input.description,
    totalAmount: input.totalAmount,
    assetCode: input.assetCode,
    assetIssuer: input.assetIssuer,
    collectorAddress: input.collectorAddress,
    status: "open",
    createdAt,
    participants,
  };
}

async function getSplit(id: string): Promise<Split | null> {
  const db = await ready();
  const result = await db.execute({ sql: `SELECT * FROM splits WHERE id = ?`, args: [id] });
  const row = result.rows[0];
  if (!row) return null;
  return toSplit(row, await fetchParticipants(db, id));
}

async function listSplitsByCollector(collectorAddress: string): Promise<Split[]> {
  const db = await ready();
  const result = await db.execute({
    sql: `SELECT * FROM splits WHERE collector_address = ? ORDER BY created_at DESC`,
    args: [collectorAddress],
  });
  const splits: Split[] = [];
  for (const row of result.rows) {
    splits.push(toSplit(row, await fetchParticipants(db, row.id as string)));
  }
  return splits;
}

async function getParticipant(id: string): Promise<SplitParticipant | null> {
  const db = await ready();
  const result = await db.execute({
    sql: `SELECT * FROM split_participants WHERE id = ?`,
    args: [id],
  });
  return result.rows[0] ? toParticipant(result.rows[0]) : null;
}

/**
 * Same atomic-record contract as the Neon driver (see its `recordPayment`
 * doc), adapted to libSQL: a conditional `UPDATE ... WHERE paid_at IS NULL
 * RETURNING id` closes the double-record race, and a caught unique-index
 * violation (surfaced as a message, not an error code, on this driver)
 * means the hash was already used elsewhere.
 */
async function recordPayment(
  participantId: string,
  payerAddress: string,
  hash: string
): Promise<boolean> {
  const db = await ready();
  try {
    const result = await db.execute({
      sql: `UPDATE split_participants
            SET payer_address = ?, tx_hash = ?, paid_at = ?
            WHERE id = ? AND paid_at IS NULL
            RETURNING id`,
      args: [payerAddress, hash, new Date().toISOString(), participantId],
    });
    return result.rows.length > 0;
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message)) {
      return false; // this hash is already recorded
    }
    throw err;
  }
}

async function isHashUsed(hash: string): Promise<boolean> {
  const db = await ready();
  const result = await db.execute({
    sql: `SELECT 1 FROM split_participants WHERE tx_hash = ?`,
    args: [hash],
  });
  return result.rows.length > 0;
}

async function closeSplit(id: string): Promise<void> {
  const db = await ready();
  await db.execute({ sql: `UPDATE splits SET status = 'closed' WHERE id = ?`, args: [id] });
}

async function allParticipantsPaid(splitId: string): Promise<boolean> {
  const db = await ready();
  const result = await db.execute({
    sql: `SELECT COUNT(*) as pending FROM split_participants WHERE split_id = ? AND paid_at IS NULL`,
    args: [splitId],
  });
  return Number(result.rows[0]?.pending ?? 0) === 0;
}

export const sqliteDb = {
  createSplit,
  getSplit,
  listSplitsByCollector,
  getParticipant,
  recordPayment,
  isHashUsed,
  closeSplit,
  allParticipantsPaid,
};
