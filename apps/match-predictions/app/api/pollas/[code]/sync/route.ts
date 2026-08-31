import { findPolla, loadPolla } from "@/lib/queries";
import { syncEntries } from "@/lib/reconcile";
import { currentAddress, NotFound, route } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Sweeps the organizer's account now instead of waiting for the next page load.
 *
 * Open to anyone with the link on purpose: a player watching the join screen
 * for their own payment to register should not need to be signed in to make the
 * app look. It only reads public Horizon data and can only ever mark an entry
 * paid that the ledger already shows as paid, so there is nothing here to
 * abuse beyond the rate limit in lib/reconcile.ts.
 */
export const POST = route(async (_request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");

  const result =
    polla.status === "open"
      ? await syncEntries(polla).catch(() => null)
      : null;

  return Response.json({
    settled: result?.settled.length ?? 0,
    polla: await loadPolla(polla, await currentAddress()),
  });
});
