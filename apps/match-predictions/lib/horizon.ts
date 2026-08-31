import { HORIZON_URL, toStroops, USDC } from "@/lib/stellar";

/**
 * Server-side payment verification against the Stellar ledger.
 *
 * Players pay from inside this app, so `runTx` hands their browser a hash.
 * But a browser can claim any hash it likes, and in a polla the claim is
 * "I paid my entry, count me in". Nothing is marked as paid until Horizon
 * confirms that THIS hash is a successful payment of THIS amount, in USDC, to
 * THIS account, carrying THIS entry's reference.
 *
 * Horizon is public and read-only: no key, no account, no Pollar involvement,
 * so anyone in the group can repeat every check by hand in the explorer.
 */

export interface PaymentExpectation {
  hash: string;
  /** Where the money must have landed. */
  destination: string;
  /** Where it must have come from. Omitted when any payer is acceptable. */
  source?: string;
  /** Decimal string, e.g. "5.00". */
  amount: string;
  /** The reference travelling as a Stellar MEMO_ID (uint64 as a string). */
  memoId: string;
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  expected: string;
  actual: string;
}

export interface VerificationResult {
  ok: boolean;
  checks: Check[];
  ledger?: number;
  /** Raw Horizon payloads, so the spike page can show what the ledger says. */
  raw?: { transaction: unknown; operations: unknown };
  error?: string;
}

interface HorizonTx {
  hash: string;
  successful: boolean;
  memo?: string;
  memo_type?: string;
  created_at: string;
  ledger: number;
}

interface HorizonOp {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
}

/**
 * A transaction is not queryable the instant it is submitted: the ledger closes
 * every ~5 seconds and Horizon indexes shortly after, so a 404 here means "not
 * yet", not "never". Worth retrying before telling a player their payment
 * didn't count.
 */
async function fetchWithRetry(
  url: string,
  attempts = 6,
  delayMs = 1500
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status !== 404) return res;
    last = res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return last!;
}

export async function verifyPayment(
  expect: PaymentExpectation
): Promise<VerificationResult> {
  const txRes = await fetchWithRetry(
    `${HORIZON_URL}/transactions/${encodeURIComponent(expect.hash)}`
  );

  if (!txRes.ok) {
    return {
      ok: false,
      checks: [],
      error:
        txRes.status === 404
          ? "Horizon no conoce ese hash. O la transacción nunca llegó a la red, o todavía no está indexada."
          : `Horizon respondió ${txRes.status}.`,
    };
  }

  const tx = (await txRes.json()) as HorizonTx;
  const opsRes = await fetch(
    `${HORIZON_URL}/transactions/${encodeURIComponent(expect.hash)}/operations`,
    { cache: "no-store" }
  );
  const opsBody = (await opsRes.json()) as {
    _embedded?: { records?: HorizonOp[] };
  };
  const ops = opsBody._embedded?.records ?? [];

  // The payment we care about, not any other operation bundled in the tx.
  const payment = ops.find(
    (op) => op.type === "payment" && op.to === expect.destination
  );

  const checks: Check[] = [
    {
      id: "successful",
      label: "La transacción se confirmó en la red",
      ok: tx.successful === true,
      expected: "true",
      actual: String(tx.successful),
    },
    {
      id: "destination",
      label: "El dinero llegó a la cuenta esperada",
      ok: payment?.to === expect.destination,
      expected: expect.destination,
      actual: payment?.to ?? "(ningún pago a esa cuenta)",
    },
    {
      id: "amount",
      label: "El monto coincide",
      ok:
        payment?.amount !== undefined &&
        toStroops(payment.amount) === toStroops(expect.amount),
      expected: expect.amount,
      actual: payment?.amount ?? "(ninguno)",
    },
    {
      id: "asset",
      label: "Se pagó en el USDC esperado, no en otro activo",
      ok:
        payment?.asset_code === USDC.code &&
        payment?.asset_issuer === USDC.issuer,
      expected: `${USDC.code} / ${USDC.issuer}`,
      actual: payment?.asset_code
        ? `${payment.asset_code} / ${payment.asset_issuer}`
        : (payment?.asset_type ?? "(ninguno)"),
    },
    {
      id: "memo",
      label: "Lleva la referencia de esta polla",
      ok: tx.memo_type === "id" && tx.memo === expect.memoId,
      expected: `id:${expect.memoId}`,
      actual: tx.memo_type ? `${tx.memo_type}:${tx.memo ?? ""}` : "(sin memo)",
    },
  ];

  if (expect.source !== undefined) {
    checks.push({
      id: "source",
      label: "Salió de la cuenta esperada",
      ok: payment?.from === expect.source,
      expected: expect.source,
      actual: payment?.from ?? "(ninguno)",
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
    ledger: tx.ledger,
    raw: { transaction: tx, operations: ops },
  };
}
