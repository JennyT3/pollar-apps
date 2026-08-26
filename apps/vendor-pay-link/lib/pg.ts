import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Charge, Sale, SaleKind, SaleStatus, Vendor } from "./types";

type Sql = NeonQueryFunction<false, false>;

let sql: Sql | null = null;
let schemaReady: Promise<void> | null = null;

function postgresUrl(): string | undefined {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim()
  );
}

export function hasDatabaseUrl(): boolean {
  return Boolean(postgresUrl());
}

export function getSql(): Sql {
  const url = postgresUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!sql) sql = neon(url);
  return sql;
}

export async function ensureSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getSql();
      await db`
        CREATE TABLE IF NOT EXISTS vendors (
          address TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          public_code TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS charges (
          id TEXT PRIMARY KEY,
          vendor_address TEXT NOT NULL REFERENCES vendors(address),
          amount TEXT NOT NULL,
          note TEXT,
          sale_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )`;
      await db`
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          vendor_address TEXT NOT NULL REFERENCES vendors(address),
          amount TEXT NOT NULL,
          note TEXT,
          kind TEXT NOT NULL,
          charge_id TEXT,
          status TEXT NOT NULL,
          memo TEXT NOT NULL,
          tx_hash TEXT UNIQUE,
          paid_at TIMESTAMPTZ,
          claimed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL
        )`;
      await db`CREATE INDEX IF NOT EXISTS sales_vendor_idx ON sales (vendor_address)`;
      await db`CREATE INDEX IF NOT EXISTS sales_status_idx ON sales (status)`;
    })();
  }
  await schemaReady;
}

type VendorRow = {
  address: string;
  name: string;
  public_code: string;
  created_at: string;
};

type ChargeRow = {
  id: string;
  vendor_address: string;
  amount: string;
  note: string | null;
  sale_id: string;
  created_at: string;
};

type SaleRow = {
  id: string;
  vendor_address: string;
  amount: string;
  note: string | null;
  kind: string;
  charge_id: string | null;
  status: string;
  memo: string;
  tx_hash: string | null;
  paid_at: string | null;
  claimed_at: string | null;
  created_at: string;
};

export function vendorFromRow(row: VendorRow): Vendor {
  return {
    address: row.address,
    name: row.name,
    publicCode: row.public_code,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function chargeFromRow(row: ChargeRow): Charge {
  return {
    id: row.id,
    vendorAddress: row.vendor_address,
    amount: row.amount,
    note: row.note,
    saleId: row.sale_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function saleFromRow(row: SaleRow): Sale {
  return {
    id: row.id,
    vendorAddress: row.vendor_address,
    amount: row.amount,
    note: row.note,
    kind: row.kind as SaleKind,
    chargeId: row.charge_id,
    status: row.status as SaleStatus,
    memo: row.memo,
    txHash: row.tx_hash,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export type { VendorRow, ChargeRow, SaleRow };
