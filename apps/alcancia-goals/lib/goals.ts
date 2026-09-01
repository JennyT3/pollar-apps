import { db } from "@/lib/db";
import { sumAmounts } from "@/lib/decimal";

export type GoalMode = "personal" | "shared";
export type GoalStatus = "active" | "completed" | "archived";

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: string;
  deadline: string | null;
  mode: GoalMode;
  currency: string;
  ownerAddress: string;
  keeperAddress: string | null;
  status: GoalStatus;
  createdAt: string;
}

export interface SetAside {
  id: string;
  goalId: string;
  ownerAddress: string;
  amount: string;
  createdAt: string;
}

export interface Contribution {
  id: string;
  goalId: string;
  contributorAddress: string;
  amount: string;
  txHash: string;
  verified: boolean;
  createdAt: string;
}

export interface Member {
  goalId: string;
  address: string;
  joinedAt: string;
}

/** One entry in a goal's activity feed: a set-aside or a contribution. */
export interface HistoryEntry {
  id: string;
  kind: "set_aside" | "contribution";
  address: string;
  amount: string;
  txHash: string | null;
  verified: boolean | null;
  createdAt: string;
}

/**
 * Shared-goal contributions bind the payment to a goal via a Stellar
 * MEMO_TEXT, which is capped at 28 bytes — too short for a full UUID (36
 * chars). Goal ids are the only ones that travel as a memo, so only they
 * need this shorter form; contributions/set-asides keep `crypto.randomUUID()`.
 */
function shortId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function toGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    targetAmount: row.target_amount as string,
    deadline: (row.deadline as string | null) ?? null,
    mode: row.mode as GoalMode,
    currency: row.currency as string,
    ownerAddress: row.owner_address as string,
    keeperAddress: (row.keeper_address as string | null) ?? null,
    status: row.status as GoalStatus,
    createdAt: row.created_at as string,
  };
}

export async function createGoal(input: {
  name: string;
  emoji: string;
  targetAmount: string;
  deadline: string | null;
  mode: GoalMode;
  currency: string;
  ownerAddress: string;
}): Promise<Goal> {
  const client = await db();
  const id = shortId();
  const keeperAddress = input.mode === "shared" ? input.ownerAddress : null;
  await client.execute({
    sql: `INSERT INTO goals (id, name, emoji, target_amount, deadline, mode, currency, owner_address, keeper_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.name,
      input.emoji,
      input.targetAmount,
      input.deadline,
      input.mode,
      input.currency,
      input.ownerAddress,
      keeperAddress,
    ],
  });
  if (input.mode === "shared") {
    await client.execute({
      sql: `INSERT OR IGNORE INTO members (goal_id, address) VALUES (?, ?)`,
      args: [id, input.ownerAddress],
    });
  }
  const goal = await getGoal(id);
  if (!goal) throw new Error("Failed to create goal");
  return goal;
}

export async function getGoal(id: string): Promise<Goal | null> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT * FROM goals WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  return row ? toGoal(row as unknown as Record<string, unknown>) : null;
}

/** Goals visible to `address`: personal goals they own, plus shared goals they belong to. */
export async function listGoalsForAddress(address: string): Promise<Goal[]> {
  const client = await db();
  const res = await client.execute({
    sql: `
      SELECT g.* FROM goals g
      WHERE (g.mode = 'personal' AND g.owner_address = ?)
         OR (g.mode = 'shared' AND EXISTS (
              SELECT 1 FROM members m WHERE m.goal_id = g.id AND m.address = ?
            ))
      ORDER BY g.created_at DESC
    `,
    args: [address, address],
  });
  return res.rows.map((r) => toGoal(r as unknown as Record<string, unknown>));
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `UPDATE goals SET status = ? WHERE id = ?`,
    args: [status, id],
  });
}

export async function addSetAside(
  goalId: string,
  ownerAddress: string,
  amount: string
): Promise<SetAside> {
  const client = await db();
  const id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO set_asides (id, goal_id, owner_address, amount) VALUES (?, ?, ?, ?)`,
    args: [id, goalId, ownerAddress, amount],
  });
  const res = await client.execute({
    sql: `SELECT * FROM set_asides WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0] as unknown as Record<string, unknown>;
  return {
    id: row.id as string,
    goalId: row.goal_id as string,
    ownerAddress: row.owner_address as string,
    amount: row.amount as string,
    createdAt: row.created_at as string,
  };
}

export async function totalSetAsideForGoal(goalId: string): Promise<string> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT amount FROM set_asides WHERE goal_id = ?`,
    args: [goalId],
  });
  return sumAmounts(res.rows.map((r) => (r as unknown as Record<string, unknown>).amount as string));
}

/** Sum of set-asides across every ACTIVE personal goal owned by `address` — the coverage check's "committed" side. */
export async function totalCommittedForOwner(address: string): Promise<string> {
  const client = await db();
  const res = await client.execute({
    sql: `
      SELECT sa.amount FROM set_asides sa
      JOIN goals g ON g.id = sa.goal_id
      WHERE g.owner_address = ? AND g.mode = 'personal' AND g.status = 'active'
    `,
    args: [address],
  });
  return sumAmounts(res.rows.map((r) => (r as unknown as Record<string, unknown>).amount as string));
}

export async function addMember(goalId: string, address: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `INSERT OR IGNORE INTO members (goal_id, address) VALUES (?, ?)`,
    args: [goalId, address],
  });
}

export async function isMember(goalId: string, address: string): Promise<boolean> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT 1 FROM members WHERE goal_id = ? AND address = ?`,
    args: [goalId, address],
  });
  return res.rows.length > 0;
}

export async function listMembers(goalId: string): Promise<Member[]> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT * FROM members WHERE goal_id = ? ORDER BY joined_at ASC`,
    args: [goalId],
  });
  return res.rows.map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      goalId: row.goal_id as string,
      address: row.address as string,
      joinedAt: row.joined_at as string,
    };
  });
}

export async function addContribution(
  goalId: string,
  contributorAddress: string,
  amount: string,
  txHash: string,
  verified: boolean
): Promise<Contribution> {
  const client = await db();
  const id = crypto.randomUUID();
  await client.execute({
    sql: `INSERT INTO contributions (id, goal_id, contributor_address, amount, tx_hash, verified) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, goalId, contributorAddress, amount, txHash, verified ? 1 : 0],
  });
  await addMember(goalId, contributorAddress);
  const res = await client.execute({
    sql: `SELECT * FROM contributions WHERE id = ?`,
    args: [id],
  });
  return rowToContribution(res.rows[0] as unknown as Record<string, unknown>);
}

function rowToContribution(row: Record<string, unknown>): Contribution {
  return {
    id: row.id as string,
    goalId: row.goal_id as string,
    contributorAddress: row.contributor_address as string,
    amount: row.amount as string,
    txHash: row.tx_hash as string,
    verified: Boolean(row.verified),
    createdAt: row.created_at as string,
  };
}

export async function getContributionByHash(txHash: string): Promise<Contribution | null> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT * FROM contributions WHERE tx_hash = ?`,
    args: [txHash],
  });
  const row = res.rows[0];
  return row ? rowToContribution(row as unknown as Record<string, unknown>) : null;
}

export async function totalContributionsForGoal(goalId: string): Promise<string> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT amount FROM contributions WHERE goal_id = ?`,
    args: [goalId],
  });
  return sumAmounts(res.rows.map((r) => (r as unknown as Record<string, unknown>).amount as string));
}

/** Per-member contribution totals for a shared goal, highest first. */
export async function contributionsByMember(
  goalId: string
): Promise<{ address: string; total: string }[]> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT contributor_address, amount FROM contributions WHERE goal_id = ?`,
    args: [goalId],
  });
  const byAddress = new Map<string, string[]>();
  for (const r of res.rows) {
    const row = r as unknown as Record<string, unknown>;
    const address = row.contributor_address as string;
    const list = byAddress.get(address) ?? [];
    list.push(row.amount as string);
    byAddress.set(address, list);
  }
  return Array.from(byAddress.entries())
    .map(([address, amounts]) => ({ address, total: sumAmounts(amounts) }))
    .sort((a, b) => Number(b.total) - Number(a.total));
}

export async function listHistory(goalId: string): Promise<HistoryEntry[]> {
  const client = await db();
  const [setAsides, contributions] = await Promise.all([
    client.execute({
      sql: `SELECT * FROM set_asides WHERE goal_id = ? ORDER BY created_at DESC`,
      args: [goalId],
    }),
    client.execute({
      sql: `SELECT * FROM contributions WHERE goal_id = ? ORDER BY created_at DESC`,
      args: [goalId],
    }),
  ]);

  const entries: HistoryEntry[] = [
    ...setAsides.rows.map((r) => {
      const row = r as unknown as Record<string, unknown>;
      return {
        id: row.id as string,
        kind: "set_aside" as const,
        address: row.owner_address as string,
        amount: row.amount as string,
        txHash: null,
        verified: null,
        createdAt: row.created_at as string,
      };
    }),
    ...contributions.rows.map((r) => {
      const row = r as unknown as Record<string, unknown>;
      return {
        id: row.id as string,
        kind: "contribution" as const,
        address: row.contributor_address as string,
        amount: row.amount as string,
        txHash: row.tx_hash as string,
        verified: Boolean(row.verified),
        createdAt: row.created_at as string,
      };
    }),
  ];

  return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
