import { neonDb } from "@/lib/db/neon";
import { sqliteDb } from "@/lib/db/sqlite";

/**
 * `DATABASE_URL` set → Neon (Postgres), for production, where a local file
 * doesn't survive between serverless invocations. Unset → a local SQLite
 * file, so `pnpm install && pnpm dev` works with nothing but the Pollar key
 * in `.env` — no external database account needed to run this locally.
 * Same schema either way; every caller in this app imports these names
 * without knowing which driver is behind them.
 */
const db = process.env.DATABASE_URL ? neonDb : sqliteDb;

export const createSplit = db.createSplit;
export const getSplit = db.getSplit;
export const listSplitsByCollector = db.listSplitsByCollector;
export const getParticipant = db.getParticipant;
export const recordPayment = db.recordPayment;
export const isHashUsed = db.isHashUsed;
export const closeSplit = db.closeSplit;
export const allParticipantsPaid = db.allParticipantsPaid;
