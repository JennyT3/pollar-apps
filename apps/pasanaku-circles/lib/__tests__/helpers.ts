import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createCircle, joinCircle } from "@/lib/circles";

export const USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AT7L7TXMV4L";

export const A = "G" + "A".repeat(55);
export const B = "G" + "B".repeat(55);
export const C = "G" + "C".repeat(55);
export const D = "G" + "D".repeat(55);

export function gAddress(ch: string): string {
  return "G" + ch.repeat(55);
}

export type HorizonOp = {
  type: string;
  from: string;
  to: string;
  amount: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

export type HorizonTx = {
  hash: string;
  successful?: boolean;
  memo?: string | null;
  memoType?: string | null;
  ops?: HorizonOp[];
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

export function stubHorizon(tx: HorizonTx): void {
  const ops = tx.ops ?? [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(`/transactions/${tx.hash}/operations`)) {
      return jsonResponse({ _embedded: { records: ops } });
    }
    if (url.includes(`/transactions/${tx.hash}`)) {
      return jsonResponse({
        successful: tx.successful ?? true,
        memo: tx.memo ?? null,
        memo_type: tx.memoType ?? (tx.memo ? "id" : null),
      });
    }
    return jsonResponse({ detail: "not found" }, 404);
  });
}

export function usdcPayment(input: {
  hash: string;
  from: string;
  to: string;
  amount: string;
  memo: string;
  extraOps?: HorizonOp[];
  issuer?: string;
  opType?: string;
  memoType?: string | null;
  includeMemo?: boolean;
}): HorizonTx {
  const op: HorizonOp = {
    type: input.opType ?? "payment",
    from: input.from,
    to: input.to,
    amount: input.amount,
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: input.issuer ?? USDC_ISSUER,
  };
  return {
    hash: input.hash,
    successful: true,
    memo: input.includeMemo === false ? null : input.memo,
    memoType:
      input.memoType === undefined
        ? input.includeMemo === false
          ? null
          : "id"
        : input.memoType,
    ops: [op, ...(input.extraOps ?? [])],
  };
}

export function nativePayment(input: {
  hash: string;
  from: string;
  to: string;
  amount: string;
  memo: string;
}): HorizonTx {
  return {
    hash: input.hash,
    successful: true,
    memo: input.memo,
    memoType: "id",
    ops: [
      {
        type: "payment",
        from: input.from,
        to: input.to,
        amount: input.amount,
        asset_type: "native",
      },
    ],
  };
}

export async function threeMemberCircle(amount = "10") {
  const created = await createCircle({
    name: "test circle",
    amount,
    frequency: "weekly",
    organizerAddress: A,
    shuffle: false,
  });
  await joinCircle(created.code, B);
  await joinCircle(created.code, C);
  return created;
}

export function isolatedDb() {
  beforeEach(() => {
    resetDbForTests();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pasanaku-"));
    process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "t.db")}`;
    delete process.env.TURSO_AUTH_TOKEN;
  });

  afterEach(() => {
    resetDbForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
