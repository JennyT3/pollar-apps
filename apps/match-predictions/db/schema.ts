import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Timestamps are stored as epoch milliseconds. A polla is a deadline with
 * friends attached, and comparing "is it locked?" has to be exact and
 * timezone-free; the UI formats for Bolivia at the edge.
 */
const createdAt = () =>
  integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const pollas = sqliteTable(
  "pollas",
  {
    id: text("id").primaryKey(),
    /** Short human code, the one in the join link and the QR: /p/<code>. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Where the pot sits. The app never holds funds. */
    organizerAddress: text("organizer_address").notNull(),
    organizerName: text("organizer_name").notNull(),
    /** Decimal string, e.g. "5.00". Every player pays exactly this. */
    entryAmount: text("entry_amount").notNull(),
    /** Predictions freeze at this instant. Epoch ms. */
    deadlineAt: integer("deadline_at").notNull(),
    /** Declared upfront, applied automatically. See lib/scoring.ts. */
    exactPoints: integer("exact_points").notNull(),
    outcomePoints: integer("outcome_points").notNull(),
    /** `open` until the organizer settles it; then `settled`, forever. */
    status: text("status", { enum: ["open", "settled"] })
      .notNull()
      .default("open"),
    /** The pot at the moment of settling, frozen so payouts can't drift. */
    settledPot: text("settled_pot"),
    settledAt: integer("settled_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("pollas_code_unique").on(table.code),
    index("pollas_organizer_idx").on(table.organizerAddress),
  ]
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    pollaId: text("polla_id")
      .notNull()
      .references(() => pollas.id, { onDelete: "cascade" }),
    /** Fixed display order, decided when the polla is created. */
    position: integer("position").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoffAt: integer("kickoff_at").notNull(),
    /** Final score, entered by the organizer. Null until then. */
    homeGoals: integer("home_goals"),
    awayGoals: integer("away_goals"),
    resultAt: integer("result_at"),
  },
  (table) => [
    uniqueIndex("matches_polla_position_unique").on(table.pollaId, table.position),
    index("matches_polla_idx").on(table.pollaId),
  ]
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    pollaId: text("polla_id")
      .notNull()
      .references(() => pollas.id, { onDelete: "cascade" }),
    playerAddress: text("player_address").notNull(),
    playerName: text("player_name").notNull(),
    /**
     * This entry's reference, travelling as the Stellar MEMO_ID of the
     * payment. It is what turns an incoming payment into "this player, this
     * polla" without trusting anything the browser says.
     */
    memoId: integer("memo_id").notNull(),
    /** Snapshot of the entry amount, so a later edit can't rewrite the past. */
    amount: text("amount").notNull(),
    status: text("status", { enum: ["pending", "paid"] })
      .notNull()
      .default("pending"),
    txHash: text("tx_hash"),
    ledger: integer("ledger"),
    paidAt: integer("paid_at"),
    createdAt: createdAt(),
  },
  (table) => [
    // One entry per player per polla: you are in once, for one entry amount.
    uniqueIndex("entries_polla_player_unique").on(table.pollaId, table.playerAddress),
    uniqueIndex("entries_memo_unique").on(table.memoId),
    // A payment settles exactly one entry, even if it is reported twice.
    uniqueIndex("entries_tx_unique").on(table.txHash),
    index("entries_polla_idx").on(table.pollaId),
  ]
);

export const predictions = sqliteTable(
  "predictions",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    homeGoals: integer("home_goals").notNull(),
    awayGoals: integer("away_goals").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("predictions_entry_match_unique").on(table.entryId, table.matchId),
    index("predictions_entry_idx").on(table.entryId),
  ]
);

export const payouts = sqliteTable(
  "payouts",
  {
    id: text("id").primaryKey(),
    pollaId: text("polla_id")
      .notNull()
      .references(() => pollas.id, { onDelete: "cascade" }),
    winnerAddress: text("winner_address").notNull(),
    winnerName: text("winner_name").notNull(),
    amount: text("amount").notNull(),
    memoId: integer("memo_id").notNull(),
    /**
     * `prepared` → waiting for the organizer to confirm the prefilled payment.
     * `paid` → confirmed on the ledger, hash recorded.
     * `kept` → the winner IS the organizer, so the money is already in the
     * right account and there is nothing to send. Recorded, never invented.
     */
    status: text("status", { enum: ["prepared", "paid", "kept"] })
      .notNull()
      .default("prepared"),
    txHash: text("tx_hash"),
    ledger: integer("ledger"),
    paidAt: integer("paid_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("payouts_polla_winner_unique").on(table.pollaId, table.winnerAddress),
    uniqueIndex("payouts_memo_unique").on(table.memoId),
    uniqueIndex("payouts_tx_unique").on(table.txHash),
    index("payouts_polla_idx").on(table.pollaId),
  ]
);

/**
 * Where the Horizon sweep for a polla got to. Keeping the cursor means each
 * pass only asks for payments that arrived since the last one, instead of
 * re-reading the organizer's whole account history every few seconds.
 */
export const syncState = sqliteTable("sync_state", {
  pollaId: text("polla_id")
    .primaryKey()
    .references(() => pollas.id, { onDelete: "cascade" }),
  lastCursor: text("last_cursor"),
  syncedAt: integer("synced_at").notNull(),
});

/**
 * Sign-in sessions, keyed by a random token held in an httpOnly cookie.
 *
 * The address in a session was proved with a SEP-53 signature (see
 * lib/session.ts), so a row here means "this browser holds the key to this
 * Pollar account", which is what authorises entering results or editing a
 * prediction.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the cookie value. The token itself is never stored. */
    tokenHash: text("token_hash").primaryKey(),
    address: text("address").notNull(),
    createdAt: createdAt(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sessions_address_idx").on(table.address)]
);

/** Single-use challenges handed out for SEP-53 sign-in. */
export const challenges = sqliteTable("challenges", {
  nonce: text("nonce").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});

export type Polla = typeof pollas.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
