import { updateStore, readStore } from "./db";
import {
  inspectPaymentOnHorizon,
  verifyPaymentOnHorizon,
} from "./horizon";
import { memoForSale, newPublicCode, newSaleId, saleIdFromMemo } from "./ids";
import {
  chargeFromRow,
  ensureSchema,
  getSql,
  hasDatabaseUrl,
  saleFromRow,
  vendorFromRow,
  type ChargeRow,
  type SaleRow,
  type VendorRow,
} from "./pg";
import type { Charge, Sale, Vendor } from "./types";

const CLAIM_TTL_MS = 5 * 60 * 1000;

function shouldUsePg(): boolean {
  if (process.env.VERCEL && !hasDatabaseUrl()) {
    throw new Error(
      "DATABASE_URL is required on Vercel (ephemeral filesystem cannot store sales)."
    );
  }
  return hasDatabaseUrl();
}

function claimExpired(sale: Sale): boolean {
  if (sale.status !== "paying" || !sale.claimedAt) return true;
  return Date.now() - new Date(sale.claimedAt).getTime() > CLAIM_TTL_MS;
}

export async function getVendorByAddress(address: string): Promise<Vendor | null> {
  if (!shouldUsePg()) return readStore().vendors[address] ?? null;
  await ensureSchema();
  const rows = await getSql()`
    SELECT address, name, public_code, created_at
    FROM vendors WHERE address = ${address}
    LIMIT 1` as VendorRow[];
  return rows[0] ? vendorFromRow(rows[0]) : null;
}

export async function getVendorByCode(code: string): Promise<Vendor | null> {
  if (!shouldUsePg()) {
    return (
      Object.values(readStore().vendors).find(
        (v) => v.publicCode.toLowerCase() === code.toLowerCase()
      ) ?? null
    );
  }
  await ensureSchema();
  const rows = await getSql()`
    SELECT address, name, public_code, created_at
    FROM vendors WHERE lower(public_code) = ${code.toLowerCase()}
    LIMIT 1` as VendorRow[];
  return rows[0] ? vendorFromRow(rows[0]) : null;
}

export async function upsertVendor(address: string, name: string): Promise<Vendor> {
  const trimmed = name.trim();
  if (!shouldUsePg()) {
    let vendor: Vendor | null = null;
    updateStore((store) => {
      const existing = store.vendors[address];
      if (existing) {
        existing.name = trimmed;
        vendor = existing;
        return;
      }
      vendor = {
        address,
        name: trimmed,
        publicCode: newPublicCode(),
        createdAt: new Date().toISOString(),
      };
      store.vendors[address] = vendor;
    });
    return vendor!;
  }
  await ensureSchema();
  const db = getSql();
  const existing = (await db`
    SELECT address, name, public_code, created_at
    FROM vendors WHERE address = ${address} LIMIT 1`) as VendorRow[];
  if (existing[0]) {
    const rows = (await db`
      UPDATE vendors SET name = ${trimmed}
      WHERE address = ${address}
      RETURNING address, name, public_code, created_at`) as VendorRow[];
    return vendorFromRow(rows[0]);
  }
  const created = new Date().toISOString();
  const publicCode = newPublicCode();
  const rows = (await db`
    INSERT INTO vendors (address, name, public_code, created_at)
    VALUES (${address}, ${trimmed}, ${publicCode}, ${created})
    RETURNING address, name, public_code, created_at`) as VendorRow[];
  return vendorFromRow(rows[0]);
}

export async function createCharge(
  vendorAddress: string,
  amount: string,
  note: string | null
): Promise<{ charge: Charge; sale: Sale }> {
  const saleId = newSaleId();
  const chargeId = newSaleId();
  const now = new Date().toISOString();
  const sale: Sale = {
    id: saleId,
    vendorAddress,
    amount,
    note,
    kind: "charge",
    chargeId,
    status: "pending",
    memo: memoForSale(saleId),
    txHash: null,
    paidAt: null,
    claimedAt: null,
    createdAt: now,
  };
  const charge: Charge = {
    id: chargeId,
    vendorAddress,
    amount,
    note,
    saleId,
    createdAt: now,
  };
  if (!shouldUsePg()) {
    updateStore((store) => {
      store.sales[saleId] = sale;
      store.charges[chargeId] = charge;
    });
    return { charge, sale };
  }
  await ensureSchema();
  const db = getSql();
  await db`
    INSERT INTO sales (
      id, vendor_address, amount, note, kind, charge_id, status, memo,
      tx_hash, paid_at, claimed_at, created_at
    ) VALUES (
      ${sale.id}, ${sale.vendorAddress}, ${sale.amount}, ${sale.note}, ${sale.kind},
      ${sale.chargeId}, ${sale.status}, ${sale.memo}, null, null, null, ${sale.createdAt}
    )`;
  await db`
    INSERT INTO charges (id, vendor_address, amount, note, sale_id, created_at)
    VALUES (${charge.id}, ${charge.vendorAddress}, ${charge.amount}, ${charge.note},
      ${charge.saleId}, ${charge.createdAt})`;
  return { charge, sale };
}

export async function createStallSale(
  vendorAddress: string,
  amount: string,
  note: string | null
): Promise<Sale> {
  const saleId = newSaleId();
  const sale: Sale = {
    id: saleId,
    vendorAddress,
    amount,
    note,
    kind: "stall",
    chargeId: null,
    status: "pending",
    memo: memoForSale(saleId),
    txHash: null,
    paidAt: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
  };
  if (!shouldUsePg()) {
    updateStore((store) => {
      store.sales[saleId] = sale;
    });
    return sale;
  }
  await ensureSchema();
  await getSql()`
    INSERT INTO sales (
      id, vendor_address, amount, note, kind, charge_id, status, memo,
      tx_hash, paid_at, claimed_at, created_at
    ) VALUES (
      ${sale.id}, ${sale.vendorAddress}, ${sale.amount}, ${sale.note}, ${sale.kind},
      null, ${sale.status}, ${sale.memo}, null, null, null, ${sale.createdAt}
    )`;
  return sale;
}

export async function getCharge(id: string): Promise<Charge | null> {
  if (!shouldUsePg()) return readStore().charges[id] ?? null;
  await ensureSchema();
  const rows = (await getSql()`
    SELECT id, vendor_address, amount, note, sale_id, created_at
    FROM charges WHERE id = ${id} LIMIT 1`) as ChargeRow[];
  return rows[0] ? chargeFromRow(rows[0]) : null;
}

export async function getSale(id: string): Promise<Sale | null> {
  if (!shouldUsePg()) return readStore().sales[id] ?? null;
  await ensureSchema();
  const rows = (await getSql()`
    SELECT id, vendor_address, amount, note, kind, charge_id, status, memo,
           tx_hash, paid_at, claimed_at, created_at
    FROM sales WHERE id = ${id} LIMIT 1`) as SaleRow[];
  return rows[0] ? saleFromRow(rows[0]) : null;
}

export async function listSalesForVendor(address: string): Promise<Sale[]> {
  if (!shouldUsePg()) {
    return Object.values(readStore().sales)
      .filter((s) => s.vendorAddress === address)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  await ensureSchema();
  const rows = (await getSql()`
    SELECT id, vendor_address, amount, note, kind, charge_id, status, memo,
           tx_hash, paid_at, claimed_at, created_at
    FROM sales WHERE vendor_address = ${address}
    ORDER BY created_at DESC`) as SaleRow[];
  return rows.map(saleFromRow);
}

export async function listPendingSales(address: string): Promise<Sale[]> {
  const sales = await listSalesForVendor(address);
  return sales.filter((s) => s.status === "pending" || s.status === "paying");
}

export async function claimSale(
  saleId: string
): Promise<{ ok: true; sale: Sale } | { ok: false; error: string; code: string }> {
  if (!shouldUsePg()) {
    let result: { ok: true; sale: Sale } | { ok: false; error: string; code: string } =
      { ok: false, error: "Cobro no encontrado", code: "not_found" };
    updateStore((store) => {
      const sale = store.sales[saleId];
      if (!sale) return;
      if (sale.status === "paid") {
        result = { ok: false, error: "Este cobro ya fue pagado", code: "already_paid" };
        return;
      }
      if (sale.status === "paying" && !claimExpired(sale)) {
        result = {
          ok: false,
          error: "Este pago ya está en curso. Espera un momento.",
          code: "in_progress",
        };
        return;
      }
      sale.status = "paying";
      sale.claimedAt = new Date().toISOString();
      result = { ok: true, sale };
    });
    return result;
  }
  await ensureSchema();
  const db = getSql();
  const rows = (await db`
    SELECT id, vendor_address, amount, note, kind, charge_id, status, memo,
           tx_hash, paid_at, claimed_at, created_at
    FROM sales WHERE id = ${saleId} LIMIT 1`) as SaleRow[];
  if (!rows[0]) {
    return { ok: false, error: "Cobro no encontrado", code: "not_found" };
  }
  const sale = saleFromRow(rows[0]);
  if (sale.status === "paid") {
    return { ok: false, error: "Este cobro ya fue pagado", code: "already_paid" };
  }
  if (sale.status === "paying" && !claimExpired(sale)) {
    return {
      ok: false,
      error: "Este pago ya está en curso. Espera un momento.",
      code: "in_progress",
    };
  }
  const claimedAt = new Date().toISOString();
  const updated = (await db`
    UPDATE sales SET status = 'paying', claimed_at = ${claimedAt}
    WHERE id = ${saleId} AND status <> 'paid'
    RETURNING id, vendor_address, amount, note, kind, charge_id, status, memo,
              tx_hash, paid_at, claimed_at, created_at`) as SaleRow[];
  if (!updated[0]) {
    return { ok: false, error: "Este cobro ya fue pagado", code: "already_paid" };
  }
  return { ok: true, sale: saleFromRow(updated[0]) };
}

export async function releaseSale(saleId: string): Promise<void> {
  if (!shouldUsePg()) {
    updateStore((store) => {
      const sale = store.sales[saleId];
      if (!sale || sale.status !== "paying") return;
      sale.status = "pending";
      sale.claimedAt = null;
    });
    return;
  }
  await ensureSchema();
  await getSql()`
    UPDATE sales SET status = 'pending', claimed_at = null
    WHERE id = ${saleId} AND status = 'paying'`;
}

async function hashAlreadyUsed(txHash: string, exceptSaleId: string): Promise<boolean> {
  if (!shouldUsePg()) {
    return Object.values(readStore().sales).some(
      (s) => s.id !== exceptSaleId && s.txHash === txHash
    );
  }
  await ensureSchema();
  const rows = (await getSql()`
    SELECT id FROM sales WHERE tx_hash = ${txHash} AND id <> ${exceptSaleId} LIMIT 1`) as {
    id: string;
  }[];
  return Boolean(rows[0]);
}

async function markPaid(saleId: string, txHash: string): Promise<Sale | null> {
  const paidAt = new Date().toISOString();
  if (!shouldUsePg()) {
    let paid: Sale | null = null;
    updateStore((store) => {
      const sale = store.sales[saleId];
      if (!sale || sale.status === "paid") {
        paid = sale ?? null;
        return;
      }
      sale.status = "paid";
      sale.txHash = txHash;
      sale.paidAt = paidAt;
      paid = sale;
    });
    return paid;
  }
  await ensureSchema();
  const rows = (await getSql()`
    UPDATE sales
    SET status = 'paid', tx_hash = ${txHash}, paid_at = ${paidAt}
    WHERE id = ${saleId} AND status <> 'paid'
    RETURNING id, vendor_address, amount, note, kind, charge_id, status, memo,
              tx_hash, paid_at, claimed_at, created_at`) as SaleRow[];
  if (rows[0]) return saleFromRow(rows[0]);
  return getSale(saleId);
}

export async function confirmSale(
  saleId: string,
  txHash: string
): Promise<{ ok: true; sale: Sale } | { ok: false; error: string; code?: string }> {
  const sale = await getSale(saleId);
  if (!sale) {
    return { ok: false, error: "Sale not found", code: "not_found" };
  }
  if (sale.status === "paid") {
    if (sale.txHash && sale.txHash !== txHash) {
      return { ok: false, error: "Este cobro ya fue pagado", code: "already_paid" };
    }
    return { ok: true, sale };
  }
  if (await hashAlreadyUsed(txHash, saleId)) {
    return { ok: false, error: "Este pago ya está registrado", code: "duplicate_tx" };
  }

  const verified = await verifyPaymentOnHorizon({
    hash: txHash,
    vendorAddress: sale.vendorAddress,
    amount: sale.amount,
    expectedMemo: sale.memo,
  });
  if (!verified.ok) {
    return { ok: false, error: verified.error, code: "unverified" };
  }

  const paid = await markPaid(saleId, txHash);
  if (!paid) {
    return { ok: false, error: "Sale not found", code: "not_found" };
  }
  return { ok: true, sale: paid };
}

/**
 * Backup path: vendor posts candidate hashes from Pollar history.
 * Each hash is verified on Horizon (destination, amount, memo = P-{saleId}).
 * Client-supplied amounts are ignored.
 */
export async function matchIncomingPayments(
  vendorAddress: string,
  incoming: { hash: string; amount?: string; createdAt?: string }[]
): Promise<Sale[]> {
  const matched: Sale[] = [];
  for (const tx of incoming) {
    const hash = tx.hash?.trim() ?? "";
    if (!/^[a-fA-F0-9]{64}$/.test(hash)) continue;

    let inspected;
    try {
      inspected = await inspectPaymentOnHorizon(hash);
    } catch {
      continue;
    }
    if (!inspected?.successful || !inspected.memo || !inspected.destination) {
      continue;
    }
    if (inspected.destination !== vendorAddress) continue;

    const saleId = saleIdFromMemo(inspected.memo);
    if (!saleId) continue;
    const sale = await getSale(saleId);
    if (!sale || sale.vendorAddress !== vendorAddress) continue;
    if (sale.status === "paid") continue;

    const verified = await verifyPaymentOnHorizon({
      hash,
      vendorAddress,
      amount: sale.amount,
      expectedMemo: sale.memo,
    });
    if (!verified.ok) continue;
    if (await hashAlreadyUsed(hash, sale.id)) continue;

    const paid = await markPaid(sale.id, hash);
    if (paid) matched.push(paid);
  }
  return matched;
}

export function normalizeAmount(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value.trim();
  return n.toFixed(7);
}

export function startOfTodayIso(timezoneOffsetMinutes: number): string {
  const now = new Date();
  const local = new Date(now.getTime() - timezoneOffsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startUtc = Date.UTC(y, m, d, 0, 0, 0) + timezoneOffsetMinutes * 60_000;
  return new Date(startUtc).toISOString();
}

export async function todaysPaidSales(
  address: string,
  timezoneOffsetMinutes: number
): Promise<Sale[]> {
  const start = startOfTodayIso(timezoneOffsetMinutes);
  const sales = await listSalesForVendor(address);
  return sales.filter(
    (s) => s.status === "paid" && s.paidAt && s.paidAt >= start
  );
}
