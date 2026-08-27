import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwnerTokenFromRequest, ownerTokenMatches } from "@/lib/auth";

const HORIZON = "https://horizon-testnet.stellar.org";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAmount(s: string): string {
  const [int, frac = ""] = s.split(".");
  return int.padStart(1, "0") + "." + frac.padEnd(7, "0").slice(0, 7);
}

function amountsMatch(a: string, b: string): boolean {
  return normalizeAmount(a) === normalizeAmount(b);
}

async function verifyTx(
  txHash: string,
  expectedTo: string,
  expectedMemo: string,
  expectedAmount: number
): Promise<{ ok: boolean; error?: string }> {
  let txRes: Response | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${HORIZON}/transactions/${txHash}`);
    txRes = res;
    if (res.ok) break;
    if (res.status === 404 || res.status === 409) {
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }
    return { ok: false, error: "horizon_error" };
  }

  if (!txRes || !txRes.ok) {
    return { ok: false, error: "tx_not_found_after_retries" };
  }

  const tx = await txRes.json();
  if (tx.memo !== expectedMemo) return { ok: false, error: "memo_mismatch" };

  let payments: Array<{
    to: string;
    from: string;
    asset_type?: string;
    asset_code?: string;
    asset_issuer?: string;
    amount: string;
  }> = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${HORIZON}/transactions/${txHash}/payments`);
    if (res.ok) {
      const data = await res.json();
      payments = data._embedded?.records ?? [];
      break;
    }
    if (res.status === 404 || res.status === 409) {
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }
    return { ok: false, error: "payments_fetch_error" };
  }

  const payOp = payments.find((p) => p.asset_code === "USDC" && p.asset_issuer === USDC_ISSUER);
  if (!payOp) return { ok: false, error: "no_usdc_payment" };
  if (payOp.to !== expectedTo) return { ok: false, error: "destination_mismatch" };
  if (!amountsMatch(payOp.amount, String(expectedAmount))) {
    return { ok: false, error: "amount_mismatch" };
  }

  return { ok: true };
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, txHash } = body;
  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { stall: true, items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  if (status === "paid") {
    if (!txHash) {
      return NextResponse.json({ error: "txHash required for paid" }, { status: 400 });
    }
    const check = await verifyTx(txHash, order.stall.ownerAddress, order.memo, order.total);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }

  const isOwner = ownerTokenMatches(getOwnerTokenFromRequest(req), order.stall.ownerTokenHash);

  if (status === "ready" || status === "delivered" || status === "cancelled") {
    if (!isOwner) {
      return NextResponse.json({ error: "invalid_admin_token" }, { status: 401 });
    }
  }

  const update: Record<string, unknown> = { status };
  if (txHash) update.txHash = txHash;
  if (status === "paid") update.detectedAt = new Date();
  if (status === "delivered") update.deliveredAt = new Date();

  try {
    const updated = await prisma.order.update({
      where: { id },
      data: update,
      include: { items: true },
    });

    if (status === "cancelled") {
      for (const item of order.items) {
        if (item.menuItemId) {
          await prisma.menuItem.update({
            where: { id: item.menuItemId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "txHash already used" }, { status: 409 });
    }
    throw e;
  }
}