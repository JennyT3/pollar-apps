import { amountsEqual as stroopEqual } from "./asset";

const HORIZON =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export type HorizonPayment = {
  successful: boolean;
  hash: string;
  from: string;
  to: string;
  amount: string;
  assetType: string | null;
  assetCode: string | null;
  assetIssuer: string | null;
  memo: string | null;
  memoType: string | null;
  opType: string | null;
  paymentOpCount: number;
  opCount: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function fetchPayment(hash: string): Promise<HorizonPayment | null> {
  const txRes = await fetch(`${HORIZON}/transactions/${hash}`);
  if (!txRes.ok) return null;
  const tx = asRecord(await txRes.json());
  const memo = typeof tx.memo === "string" ? tx.memo : null;
  const memoType = typeof tx.memo_type === "string" ? tx.memo_type : null;

  if (tx.successful !== true) {
    return {
      successful: false,
      hash,
      from: "",
      to: "",
      amount: "",
      assetType: null,
      assetCode: null,
      assetIssuer: null,
      memo,
      memoType,
      opType: null,
      paymentOpCount: 0,
      opCount: 0,
    };
  }

  const opsRes = await fetch(`${HORIZON}/transactions/${hash}/operations?limit=200`);
  if (!opsRes.ok) return null;
  const opsBody = asRecord(await opsRes.json());
  const records = Array.isArray(opsBody._embedded)
    ? []
    : ((asRecord(opsBody._embedded).records as unknown[]) ?? []);
  const ops = records.map(asRecord);
  const paymentOps = ops.filter((op) => op.type === "payment");
  const first = ops[0] ?? {};
  const payment = paymentOps[0] ?? null;

  const assetType =
    payment && typeof payment.asset_type === "string"
      ? String(payment.asset_type)
      : null;

  return {
    successful: true,
    hash,
    from: payment ? String(payment.from ?? "") : "",
    to: payment ? String(payment.to ?? "") : "",
    amount: payment ? String(payment.amount ?? "") : "",
    assetType,
    assetCode:
      assetType === "native"
        ? "XLM"
        : payment
          ? String(payment.asset_code ?? "")
          : null,
    assetIssuer:
      assetType === "native" || !payment
        ? null
        : String(payment.asset_issuer ?? ""),
    memo,
    memoType,
    opType: typeof first.type === "string" ? String(first.type) : null,
    paymentOpCount: paymentOps.length,
    opCount: ops.length,
  };
}

export function amountsEqual(a: string, b: string): boolean {
  return stroopEqual(a, b);
}

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
