const HORIZON =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export type HorizonPayment = {
  successful: boolean;
  hash: string;
  to: string;
  amount: string;
  assetCode: string | null;
  assetIssuer: string | null;
  memo: string | null;
  memoType: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function fetchPayment(hash: string): Promise<HorizonPayment | null> {
  const txRes = await fetch(`${HORIZON}/transactions/${hash}`);
  if (!txRes.ok) return null;
  const tx = asRecord(await txRes.json());
  if (tx.successful !== true) {
    return {
      successful: false,
      hash,
      to: "",
      amount: "",
      assetCode: null,
      assetIssuer: null,
      memo: typeof tx.memo === "string" ? tx.memo : null,
      memoType: typeof tx.memo_type === "string" ? tx.memo_type : null,
    };
  }

  const opsRes = await fetch(`${HORIZON}/transactions/${hash}/operations`);
  if (!opsRes.ok) return null;
  const opsBody = asRecord(await opsRes.json());
  const records = Array.isArray(opsBody._embedded)
    ? []
    : ((asRecord(opsBody._embedded).records as unknown[]) ?? []);
  const payment = records
    .map(asRecord)
    .find((op) => op.type === "payment" || op.type === "path_payment_strict_send");

  if (!payment) return null;

  return {
    successful: true,
    hash,
    to: String(payment.to ?? ""),
    amount: String(payment.amount ?? ""),
    assetCode:
      payment.asset_type === "native" ? "XLM" : String(payment.asset_code ?? ""),
    assetIssuer:
      payment.asset_type === "native" ? null : String(payment.asset_issuer ?? ""),
    memo: typeof tx.memo === "string" ? tx.memo : null,
    memoType: typeof tx.memo_type === "string" ? tx.memo_type : null,
  };
}

export function amountsEqual(a: string, b: string): boolean {
  const left = Number.parseFloat(a);
  const right = Number.parseFloat(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.round(left * 1e7) === Math.round(right * 1e7);
}

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
