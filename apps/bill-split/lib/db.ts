import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Split, SplitParticipant } from "@/lib/split";

/**
 * Neon's HTTP driver: stateless per-query fetch calls, no connection pool to
 * manage — the right fit for serverless (Vercel functions have no
 * persistent process between invocations). Same driver locally and in
 * production, same `DATABASE_URL`.
 */
const globalDb = globalThis as {
  __billSplitSql?: NeonQueryFunction<false, false>;
  __billSplitReady?: Promise<void>;
};

function getSql(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string — see README.md."
    );
  }
  globalDb.__billSplitSql ??= neon(process.env.DATABASE_URL);
  return globalDb.__billSplitSql;
}

async function ready(): Promise<NeonQueryFunction<false, false>> {
  const sql = getSql();
  globalDb.__billSplitReady ??= (async () => {
    await sql`
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
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS split_participants (
        id TEXT PRIMARY KEY,
        split_id TEXT NOT NULL REFERENCES splits(id),
        label TEXT NOT NULL,
        share_amount TEXT NOT NULL,
        payer_address TEXT,
        tx_hash TEXT,
        paid_at TEXT
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_participants_split_id ON split_participants(split_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_splits_collector ON splits(collector_address)`;
    // Partial (NULLs excluded) so unpaid rows don't collide, but one real
    // payment can never be recorded against two different participants.
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_tx_hash
      ON split_participants(tx_hash) WHERE tx_hash IS NOT NULL
    `;
  })();
  await globalDb.__billSplitReady;
  return sql;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toParticipant(row: any): SplitParticipant {
  return {
    id: row.id,
    splitId: row.split_id,
    label: row.label,
    shareAmount: row.share_amount,
    payerAddress: row.payer_address ?? null,
    txHash: row.tx_hash ?? null,
    paidAt: row.paid_at ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSplit(row: any, participants: SplitParticipant[]): Split {
  return {
    id: row.id,
    shortRef: row.short_ref,
    description: row.description,
    totalAmount: row.total_amount,
    assetCode: row.asset_code,
    assetIssuer: row.asset_issuer,
    collectorAddress: row.collector_address,
    status: row.status === "closed" ? "closed" : "open",
    createdAt: row.created_at,
    participants,
  };
}

async function fetchParticipants(
  sql: NeonQueryFunction<false, false>,
  splitId: string
): Promise<SplitParticipant[]> {
  const rows = await sql`
    SELECT * FROM split_participants WHERE split_id = ${splitId} ORDER BY id
  `;
  return rows.map(toParticipant);
}

export async function createSplit(input: {
  description: string;
  totalAmount: string;
  assetCode: string;
  assetIssuer: string;
  collectorAddress: string;
  participants: { label: string; shareAmount: string }[];
}): Promise<Split> {
  const sql = await ready();
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

  // One round trip, all-or-nothing: a split is never left half-created if
  // an insert partway through fails.
  await sql.transaction((tx) => [
    tx`
      INSERT INTO splits (id, short_ref, description, total_amount, asset_code, asset_issuer, collector_address, status, created_at)
      VALUES (${id}, ${shortRef}, ${input.description}, ${input.totalAmount}, ${input.assetCode}, ${input.assetIssuer}, ${input.collectorAddress}, 'open', ${createdAt})
    `,
    ...participants.map(
      (p) => tx`
        INSERT INTO split_participants (id, split_id, label, share_amount)
        VALUES (${p.id}, ${id}, ${p.label}, ${p.shareAmount})
      `
    ),
  ]);

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

export async function getSplit(id: string): Promise<Split | null> {
  const sql = await ready();
  const rows = await sql`SELECT * FROM splits WHERE id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  return toSplit(row, await fetchParticipants(sql, id));
}

export async function listSplitsByCollector(collectorAddress: string): Promise<Split[]> {
  const sql = await ready();
  const rows = await sql`
    SELECT * FROM splits WHERE collector_address = ${collectorAddress} ORDER BY created_at DESC
  `;
  const splits: Split[] = [];
  for (const row of rows) {
    splits.push(toSplit(row, await fetchParticipants(sql, row.id)));
  }
  return splits;
}

export async function getParticipant(id: string): Promise<SplitParticipant | null> {
  const sql = await ready();
  const rows = await sql`SELECT * FROM split_participants WHERE id = ${id}`;
  return rows[0] ? toParticipant(rows[0]) : null;
}

/**
 * Records a payment only if the participant is still unpaid, atomically —
 * `WHERE paid_at IS NULL` in the same query closes the race window between
 * an earlier "already paid?" check and this write. Returns false if someone
 * else's request won that race, or if `hash` was already used elsewhere
 * (caught via the unique index on tx_hash) — both are "don't record it"
 * outcomes for the caller, not exceptions.
 */
export async function recordPayment(
  participantId: string,
  payerAddress: string,
  hash: string
): Promise<boolean> {
  const sql = await ready();
  try {
    const rows = await sql`
      UPDATE split_participants
      SET payer_address = ${payerAddress}, tx_hash = ${hash}, paid_at = ${new Date().toISOString()}
      WHERE id = ${participantId} AND paid_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return false; // unique violation: this hash is already recorded
    }
    throw err;
  }
}

export async function isHashUsed(hash: string): Promise<boolean> {
  const sql = await ready();
  const rows = await sql`SELECT 1 FROM split_participants WHERE tx_hash = ${hash}`;
  return rows.length > 0;
}

export async function closeSplit(id: string): Promise<void> {
  const sql = await ready();
  await sql`UPDATE splits SET status = 'closed' WHERE id = ${id}`;
}

export async function allParticipantsPaid(splitId: string): Promise<boolean> {
  const sql = await ready();
  const rows = await sql`
    SELECT COUNT(*) as pending FROM split_participants WHERE split_id = ${splitId} AND paid_at IS NULL
  `;
  return Number(rows[0]?.pending ?? 0) === 0;
}
