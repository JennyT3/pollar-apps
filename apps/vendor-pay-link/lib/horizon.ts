/**
 * Server-side verification of a claimed Stellar payment against Horizon testnet.
 * Never trust the buyer/client: destination, amount, and memo must match the sale.
 */

const HORIZON =
  process.env.HORIZON_URL?.replace(/\/$/, "") ??
  "https://horizon-testnet.stellar.org";

export type HorizonCheck = {
  ok: true;
  memo: string;
  destination: string;
  amount: string;
} | {
  ok: false;
  error: string;
  code: "not_found" | "failed" | "mismatch";
};

type HorizonTx = {
  successful?: boolean;
  memo?: string | null;
  memo_type?: string | null;
};

type HorizonOp = {
  type?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
};

function normalizeAmount(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value.trim();
  return n.toFixed(7);
}

async function horizonGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${HORIZON}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Horizon ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * Confirm `hash` is a successful payment to `vendorAddress` for `amount`
 * with text memo `expectedMemo` (P-{saleId}).
 */
export async function verifyPaymentOnHorizon(opts: {
  hash: string;
  vendorAddress: string;
  amount: string;
  expectedMemo: string;
}): Promise<HorizonCheck> {
  const hash = opts.hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return { ok: false, error: "Hash inválido", code: "mismatch" };
  }

  let tx: HorizonTx | null;
  try {
    tx = await horizonGet<HorizonTx>(`/transactions/${hash}`);
  } catch {
    return { ok: false, error: "No se pudo consultar Horizon", code: "not_found" };
  }
  if (!tx) {
    return { ok: false, error: "Transacción no encontrada en testnet", code: "not_found" };
  }
  if (!tx.successful) {
    return { ok: false, error: "La transacción no fue exitosa", code: "failed" };
  }

  const memo = (tx.memo ?? "").trim();
  if (tx.memo_type !== "text" || memo !== opts.expectedMemo) {
    return {
      ok: false,
      error: "El memo de la transacción no corresponde a este cobro",
      code: "mismatch",
    };
  }

  type OpsPage = { _embedded?: { records?: HorizonOp[] } };
  let ops: OpsPage | null;
  try {
    ops = await horizonGet<OpsPage>(
      `/transactions/${hash}/operations?limit=50`
    );
  } catch {
    return { ok: false, error: "No se pudieron leer las operaciones", code: "not_found" };
  }

  const records = ops?._embedded?.records ?? [];
  const payment = records.find((op) => {
    if (op.type !== "payment") return false;
    if (op.to !== opts.vendorAddress) return false;
    if (normalizeAmount(op.amount ?? "") !== normalizeAmount(opts.amount)) {
      return false;
    }
    return true;
  });

  if (!payment) {
    return {
      ok: false,
      error:
        "El pago en Horizon no coincide (destino del vendedor y monto)",
      code: "mismatch",
    };
  }

  return {
    ok: true,
    memo,
    destination: payment.to!,
    amount: payment.amount!,
  };
}

/** Fetch memo + first payment op for matching pending sales (backup path). */
export async function inspectPaymentOnHorizon(hash: string): Promise<{
  memo: string | null;
  destination: string | null;
  amount: string | null;
  successful: boolean;
} | null> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  const tx = await horizonGet<HorizonTx>(`/transactions/${h}`);
  if (!tx) return null;
  type OpsPage = { _embedded?: { records?: HorizonOp[] } };
  const ops = await horizonGet<OpsPage>(
    `/transactions/${h}/operations?limit=50`
  );
  const payment = (ops?._embedded?.records ?? []).find(
    (op) => op.type === "payment" && op.to && op.amount
  );
  return {
    memo: (tx.memo ?? "").trim() || null,
    destination: payment?.to ?? null,
    amount: payment?.amount ?? null,
    successful: Boolean(tx.successful),
  };
}
