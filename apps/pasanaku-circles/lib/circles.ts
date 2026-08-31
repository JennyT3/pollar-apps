import { createHash, randomBytes } from "node:crypto";
import { amountsEqual, isUsdcCredit } from "./asset";
import { migrate } from "./db";
import { fetchPayment } from "./horizon";

export type Frequency = "weekly" | "biweekly" | "monthly";

export type MemberState = "paid" | "pending" | "up_next" | "completed";

export type CircleStatus = "open" | "active" | "completed";

export type CircleView = {
  code: string;
  name: string;
  amount: string;
  frequency: Frequency;
  organizerAddress: string;
  currentRound: number;
  totalRounds: number;
  status: CircleStatus;
  recipient: string | null;
  members: {
    address: string;
    turnIndex: number;
    state: MemberState;
    paid: boolean;
  }[];
  history: {
    round: number;
    payer: string;
    recipient: string;
    amount: string;
    txHash: string;
    createdAt: number;
  }[];
  canManageTurns?: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function publicCode(): string {
  return randomBytes(6).toString("hex").slice(0, 8);
}

function looksLikeAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

export function adminCookieName(code: string): string {
  return `pasanaku_admin_${code}`;
}

function asStatus(value: unknown): CircleStatus {
  if (value === "active" || value === "completed" || value === "open") {
    return value;
  }
  return "open";
}

export async function createCircle(input: {
  name: string;
  amount: string;
  frequency: Frequency;
  organizerAddress: string;
}): Promise<{ code: string; adminToken: string }> {
  if (!input.name.trim()) throw new Error("name required");
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) {
    throw new Error("amount must be positive");
  }
  if (!["weekly", "biweekly", "monthly"].includes(input.frequency)) {
    throw new Error("invalid frequency");
  }
  if (!looksLikeAddress(input.organizerAddress)) throw new Error("invalid organizer");

  const db = await migrate();
  const adminToken = randomBytes(24).toString("hex");
  const code = publicCode();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO circles (code, name, amount, frequency, organizer_address, admin_token_hash, current_round, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, 'open', ?)`,
    args: [
      code,
      input.name.trim(),
      input.amount,
      input.frequency,
      input.organizerAddress,
      hashToken(adminToken),
      now,
    ],
  });

  const circle = await db.execute({
    sql: "SELECT id FROM circles WHERE code = ?",
    args: [code],
  });
  const circleId = Number(circle.rows[0].id);

  await db.execute({
    sql: `INSERT INTO members (circle_id, address, turn_index, joined_at) VALUES (?, ?, 0, ?)`,
    args: [circleId, input.organizerAddress, now],
  });

  return { code, adminToken };
}

export async function joinCircle(code: string, address: string): Promise<void> {
  if (!looksLikeAddress(address)) throw new Error("invalid address");
  const db = await migrate();
  const found = await db.execute({
    sql: "SELECT id, status FROM circles WHERE code = ?",
    args: [code],
  });
  if (found.rows.length === 0) throw new Error("circle not found");
  if (asStatus(found.rows[0].status) !== "open") {
    throw new Error("circle is locked");
  }
  const circleId = Number(found.rows[0].id);
  const members = await db.execute({
    sql: "SELECT address FROM members WHERE circle_id = ? ORDER BY turn_index",
    args: [circleId],
  });
  if (members.rows.some((row) => row.address === address)) return;
  await db.execute({
    sql: `INSERT INTO members (circle_id, address, turn_index, joined_at) VALUES (?, ?, ?, ?)`,
    args: [circleId, address, members.rows.length, Date.now()],
  });
}

async function requireOpen(status: CircleStatus): Promise<void> {
  if (status !== "open") throw new Error("circle is locked");
}

export async function shuffleTurns(code: string, adminToken: string): Promise<void> {
  const db = await migrate();
  const circle = await requireAdmin(code, adminToken);
  await requireOpen(circle.status);
  const members = await db.execute({
    sql: "SELECT id FROM members WHERE circle_id = ?",
    args: [circle.id],
  });
  const ids = members.rows.map((row) => Number(row.id));
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (let i = 0; i < ids.length; i += 1) {
    await db.execute({
      sql: "UPDATE members SET turn_index = ? WHERE id = ?",
      args: [i, ids[i]],
    });
  }
}

async function requireAdmin(code: string, adminToken: string) {
  const db = await migrate();
  const found = await db.execute({
    sql: "SELECT * FROM circles WHERE code = ?",
    args: [code],
  });
  if (found.rows.length === 0) throw new Error("circle not found");
  const row = found.rows[0];
  if (String(row.admin_token_hash) !== hashToken(adminToken)) {
    throw new Error("not authorized");
  }
  return {
    id: Number(row.id),
    code: String(row.code),
    amount: String(row.amount),
    currentRound: Number(row.current_round),
    organizerAddress: String(row.organizer_address),
    status: asStatus(row.status),
  };
}

export async function isAdmin(code: string, adminToken: string): Promise<boolean> {
  try {
    await requireAdmin(code, adminToken);
    return true;
  } catch {
    return false;
  }
}

export async function reorderTurns(
  code: string,
  adminToken: string,
  order: string[]
): Promise<void> {
  const db = await migrate();
  const circle = await requireAdmin(code, adminToken);
  await requireOpen(circle.status);
  const members = await db.execute({
    sql: "SELECT id, address FROM members WHERE circle_id = ?",
    args: [circle.id],
  });
  if (order.length !== members.rows.length) {
    throw new Error("order must include every member");
  }
  const byAddress = new Map(
    members.rows.map((row) => [String(row.address), Number(row.id)])
  );
  if (order.some((address) => !byAddress.has(address))) {
    throw new Error("order has unknown members");
  }
  if (new Set(order).size !== order.length) {
    throw new Error("order has duplicates");
  }
  for (let i = 0; i < order.length; i += 1) {
    const memberId = byAddress.get(order[i]);
    if (memberId === undefined) throw new Error("order has unknown members");
    await db.execute({
      sql: "UPDATE members SET turn_index = ? WHERE id = ?",
      args: [i, memberId],
    });
  }
}

export async function getCircle(code: string): Promise<CircleView | null> {
  const db = await migrate();
  const found = await db.execute({
    sql: "SELECT * FROM circles WHERE code = ?",
    args: [code],
  });
  if (found.rows.length === 0) return null;
  const circle = found.rows[0];
  const circleId = Number(circle.id);
  const currentRound = Number(circle.current_round);
  const membersRes = await db.execute({
    sql: "SELECT address, turn_index FROM members WHERE circle_id = ? ORDER BY turn_index",
    args: [circleId],
  });
  const members = membersRes.rows.map((row) => ({
    address: String(row.address),
    turnIndex: Number(row.turn_index),
  }));
  const paidRes = await db.execute({
    sql: "SELECT payer FROM payments WHERE circle_id = ? AND round = ?",
    args: [circleId, currentRound],
  });
  const paid = new Set(paidRes.rows.map((row) => String(row.payer)));
  const status = asStatus(circle.status);
  const totalRounds = members.length;
  const recipient =
    status === "completed" ? null : (members[currentRound - 1]?.address ?? null);

  const historyRes = await db.execute({
    sql: `SELECT round, payer, recipient, amount, tx_hash, created_at
          FROM payments WHERE circle_id = ? ORDER BY created_at ASC`,
    args: [circleId],
  });

  return {
    code: String(circle.code),
    name: String(circle.name),
    amount: String(circle.amount),
    frequency: String(circle.frequency) as Frequency,
    organizerAddress: String(circle.organizer_address),
    currentRound,
    totalRounds,
    status,
    recipient,
    members: members.map((member) => {
      if (status === "completed") {
        return {
          address: member.address,
          turnIndex: member.turnIndex,
          state: "completed" as const,
          paid: paid.has(member.address),
        };
      }
      const isRecipient = member.address === recipient;
      let state: MemberState = "pending";
      if (member.turnIndex < currentRound - 1) state = "completed";
      else if (isRecipient) state = "up_next";
      else if (paid.has(member.address)) state = "paid";
      return {
        address: member.address,
        turnIndex: member.turnIndex,
        state,
        paid: paid.has(member.address),
      };
    }),
    history: historyRes.rows.map((row) => ({
      round: Number(row.round),
      payer: String(row.payer),
      recipient: String(row.recipient),
      amount: String(row.amount),
      txHash: String(row.tx_hash),
      createdAt: Number(row.created_at),
    })),
  };
}

export function memoIdFor(circleId: number, round: number, payer: string): string {
  const raw = createHash("sha256")
    .update(`${circleId}:${round}:${payer}`)
    .digest()
    .readBigUInt64BE(0);
  return raw.toString();
}

function uniqueConstraint(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE/i.test(message);
}

export async function confirmPayment(input: {
  code: string;
  hash: string;
  payer: string;
}): Promise<{ round: number; recipient: string }> {
  if (!looksLikeAddress(input.payer)) throw new Error("invalid payer");
  const db = await migrate();
  const found = await db.execute({
    sql: "SELECT * FROM circles WHERE code = ?",
    args: [input.code],
  });
  if (found.rows.length === 0) throw new Error("circle not found");
  const circle = found.rows[0];
  const circleId = Number(circle.id);
  const round = Number(circle.current_round);
  const amount = String(circle.amount);
  if (asStatus(circle.status) === "completed") {
    throw new Error("circle is completed");
  }

  const members = await db.execute({
    sql: "SELECT address, turn_index FROM members WHERE circle_id = ? ORDER BY turn_index",
    args: [circleId],
  });
  if (!members.rows.some((row) => row.address === input.payer)) {
    throw new Error("not a member");
  }
  const recipient = String(members.rows[round - 1]?.address ?? "");
  if (!recipient) throw new Error("no recipient for this round");
  if (input.payer === recipient) {
    throw new Error("recipient cannot pay themselves");
  }

  const onchain = await fetchPayment(input.hash);
  if (!onchain || !onchain.successful) throw new Error("transaction not found");
  if (onchain.opCount !== 1 || onchain.paymentOpCount !== 1) {
    throw new Error("only a single payment operation is accepted");
  }
  if (onchain.opType && onchain.opType !== "payment") {
    throw new Error("path payments are not accepted");
  }
  if (onchain.from !== input.payer) throw new Error("wrong sender");
  if (onchain.to !== recipient) throw new Error("wrong destination");
  if (!amountsEqual(onchain.amount, amount)) throw new Error("wrong amount");
  if (onchain.assetType === "native" || onchain.assetCode === "XLM") {
    throw new Error("wrong asset: native xlm is not usdc");
  }
  if (!isUsdcCredit(onchain)) {
    throw new Error("wrong asset issuer");
  }

  const expectedMemo = memoIdFor(circleId, round, input.payer);
  if (onchain.memoType !== "id" || !onchain.memo) {
    throw new Error("memo required");
  }
  if (onchain.memo !== expectedMemo) {
    throw new Error("wrong memo");
  }

  try {
    await db.execute({
      sql: `INSERT INTO payments (circle_id, round, payer, recipient, amount, tx_hash, memo_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        circleId,
        round,
        input.payer,
        recipient,
        amount,
        input.hash,
        expectedMemo,
        Date.now(),
      ],
    });
  } catch (err) {
    if (uniqueConstraint(err)) {
      const existing = await db.execute({
        sql: "SELECT payer, circle_id, round FROM payments WHERE tx_hash = ?",
        args: [input.hash],
      });
      const row = existing.rows[0];
      if (
        row &&
        String(row.payer) === input.payer &&
        Number(row.circle_id) === circleId &&
        Number(row.round) === round
      ) {
        return { round, recipient };
      }
      throw new Error("transaction already used");
    }
    throw err;
  }

  if (asStatus(circle.status) === "open") {
    await db.execute({
      sql: "UPDATE circles SET status = 'active' WHERE id = ?",
      args: [circleId],
    });
  }

  const paid = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM payments WHERE circle_id = ? AND round = ?",
    args: [circleId, round],
  });
  const expectedPayers = Math.max(members.rows.length - 1, 0);
  if (Number(paid.rows[0].n) >= expectedPayers) {
    if (round >= members.rows.length) {
      await db.execute({
        sql: "UPDATE circles SET status = 'completed' WHERE id = ?",
        args: [circleId],
      });
    } else {
      await db.execute({
        sql: "UPDATE circles SET current_round = ? WHERE id = ?",
        args: [round + 1, circleId],
      });
    }
  }

  return { round, recipient };
}

export async function listCirclesFor(address: string) {
  const db = await migrate();
  const rows = await db.execute({
    sql: `SELECT c.code, c.name, c.amount, c.current_round, c.status
          FROM circles c
          JOIN members m ON m.circle_id = c.id
          WHERE m.address = ?
          ORDER BY c.created_at DESC`,
    args: [address],
  });
  return rows.rows.map((row) => ({
    code: String(row.code),
    name: String(row.name),
    amount: String(row.amount),
    currentRound: Number(row.current_round),
    status: asStatus(row.status),
  }));
}
