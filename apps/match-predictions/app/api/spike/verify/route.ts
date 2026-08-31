import { verifyPayment } from "@/lib/horizon";
import { BadRequest, route } from "@/lib/session";

/**
 * The spike's verifier: run the exact ledger checks the app runs, against any
 * hash, and show every one of them. Read-only against public Horizon, so it
 * needs no session and can be pointed at a payment made from anywhere.
 */
export const POST = route(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    hash?: unknown;
    destination?: unknown;
    source?: unknown;
    amount?: unknown;
    memoId?: unknown;
  } | null;

  const hash = typeof body?.hash === "string" ? body.hash.trim() : "";
  const destination =
    typeof body?.destination === "string" ? body.destination.trim() : "";
  const amount = typeof body?.amount === "string" ? body.amount.trim() : "";
  const memoId = body?.memoId === undefined ? "" : String(body.memoId);
  const source =
    typeof body?.source === "string" && body.source.trim()
      ? body.source.trim()
      : undefined;

  if (!hash || !destination || !amount || !memoId) {
    throw new BadRequest("Hacen falta hash, destino, monto y memo.");
  }

  return Response.json(
    await verifyPayment({ hash, destination, source, amount, memoId })
  );
});
