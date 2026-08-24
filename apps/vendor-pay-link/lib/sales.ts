import { updateStore, readStore } from "./db";
import { memoForSale, newPublicCode, newSaleId } from "./ids";
import type { Charge, Sale, Vendor } from "./types";

export function getVendorByAddress(address: string): Vendor | null {
  return readStore().vendors[address] ?? null;
}

export function getVendorByCode(code: string): Vendor | null {
  const store = readStore();
  return (
    Object.values(store.vendors).find(
      (v) => v.publicCode.toLowerCase() === code.toLowerCase()
    ) ?? null
  );
}

export function upsertVendor(address: string, name: string): Vendor {
  let vendor: Vendor | null = null;
  updateStore((store) => {
    const existing = store.vendors[address];
    if (existing) {
      existing.name = name.trim();
      vendor = existing;
      return;
    }
    vendor = {
      address,
      name: name.trim(),
      publicCode: newPublicCode(),
      createdAt: new Date().toISOString(),
    };
    store.vendors[address] = vendor;
  });
  return vendor!;
}

export function createCharge(
  vendorAddress: string,
  amount: string,
  note: string | null
): { charge: Charge; sale: Sale } {
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
  updateStore((store) => {
    store.sales[saleId] = sale;
    store.charges[chargeId] = charge;
  });
  return { charge, sale };
}

/** Buyer entered an amount on the permanent stall QR. */
export function createStallSale(
  vendorAddress: string,
  amount: string,
  note: string | null
): Sale {
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
  updateStore((store) => {
    store.sales[saleId] = sale;
  });
  return sale;
}

export function getCharge(id: string): Charge | null {
  return readStore().charges[id] ?? null;
}

export function getSale(id: string): Sale | null {
  return readStore().sales[id] ?? null;
}

export function listSalesForVendor(address: string): Sale[] {
  return Object.values(readStore().sales)
    .filter((s) => s.vendorAddress === address)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listPendingSales(address: string): Sale[] {
  return listSalesForVendor(address).filter(
    (s) => s.status === "pending" || s.status === "paying"
  );
}

const CLAIM_TTL_MS = 5 * 60 * 1000;

function claimExpired(sale: Sale): boolean {
  if (sale.status !== "paying" || !sale.claimedAt) return true;
  return Date.now() - new Date(sale.claimedAt).getTime() > CLAIM_TTL_MS;
}

/**
 * Lock a sale before the on-chain payment so two taps / two tabs can't pay twice.
 */
export function claimSale(
  saleId: string
): { ok: true; sale: Sale } | { ok: false; error: string; code: string } {
  let result: { ok: true; sale: Sale } | { ok: false; error: string; code: string } =
    { ok: false, error: "Cobro no encontrado", code: "not_found" };
  updateStore((store) => {
    const sale = store.sales[saleId];
    if (!sale) {
      result = { ok: false, error: "Cobro no encontrado", code: "not_found" };
      return;
    }
    if (sale.status === "paid") {
      result = {
        ok: false,
        error: "Este cobro ya fue pagado",
        code: "already_paid",
      };
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

/** Unlock after a failed payment so the buyer can try again. */
export function releaseSale(saleId: string): void {
  updateStore((store) => {
    const sale = store.sales[saleId];
    if (!sale || sale.status !== "paying") return;
    sale.status = "pending";
    sale.claimedAt = null;
  });
}

export function confirmSale(
  saleId: string,
  txHash: string
): { ok: true; sale: Sale } | { ok: false; error: string; code?: string } {
  let result: { ok: true; sale: Sale } | { ok: false; error: string; code?: string } =
    {
      ok: false,
      error: "Sale not found",
    };
  updateStore((store) => {
    const sale = store.sales[saleId];
    if (!sale) {
      result = { ok: false, error: "Sale not found", code: "not_found" };
      return;
    }
    if (sale.status === "paid") {
      if (sale.txHash && sale.txHash !== txHash) {
        result = {
          ok: false,
          error: "Este cobro ya fue pagado",
          code: "already_paid",
        };
        return;
      }
      result = { ok: true, sale };
      return;
    }
    const used = Object.values(store.sales).some(
      (s) => s.id !== saleId && s.txHash === txHash
    );
    if (used) {
      result = {
        ok: false,
        error: "Este pago ya está registrado",
        code: "duplicate_tx",
      };
      return;
    }
    sale.status = "paid";
    sale.txHash = txHash;
    sale.paidAt = new Date().toISOString();
    result = { ok: true, sale };
  });
  return result;
}

/**
 * Match vendor tx-history rows to pending sales by amount.
 * Used when the buyer closed the tab before the confirm callback ran.
 * Prefers exact amount + oldest pending sale; skips already-used hashes.
 */
export function matchIncomingPayments(
  vendorAddress: string,
  incoming: { hash: string; amount: string; createdAt?: string }[]
): Sale[] {
  const matched: Sale[] = [];
  updateStore((store) => {
    const usedHashes = new Set(
      Object.values(store.sales)
        .filter((s) => s.txHash)
        .map((s) => s.txHash as string)
    );
    const pending = Object.values(store.sales)
      .filter(
        (s) =>
          s.vendorAddress === vendorAddress &&
          (s.status === "pending" || s.status === "paying")
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const tx of incoming) {
      if (usedHashes.has(tx.hash)) continue;
      const idx = pending.findIndex(
        (s) => normalizeAmount(s.amount) === normalizeAmount(tx.amount)
      );
      if (idx === -1) continue;
      const sale = pending.splice(idx, 1)[0];
      const live = store.sales[sale.id];
      if (!live || live.status === "paid") continue;
      live.status = "paid";
      live.txHash = tx.hash;
      live.paidAt = new Date().toISOString();
      usedHashes.add(tx.hash);
      matched.push({ ...live });
    }
  });
  return matched;
}

export function normalizeAmount(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value.trim();
  // Compare as fixed decimals so "1.5" and "1.50" match.
  return n.toFixed(7);
}

/** Start of "today" in the vendor's local offset (minutes east of UTC). */
export function startOfTodayIso(timezoneOffsetMinutes: number): string {
  const now = new Date();
  const local = new Date(now.getTime() - timezoneOffsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startUtc = Date.UTC(y, m, d, 0, 0, 0) + timezoneOffsetMinutes * 60_000;
  return new Date(startUtc).toISOString();
}

export function todaysPaidSales(
  address: string,
  timezoneOffsetMinutes: number
): Sale[] {
  const start = startOfTodayIso(timezoneOffsetMinutes);
  return listSalesForVendor(address).filter(
    (s) => s.status === "paid" && s.paidAt && s.paidAt >= start
  );
}
