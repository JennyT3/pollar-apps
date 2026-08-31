import { findPolla, loadPolla } from "@/lib/queries";
import { syncEntries } from "@/lib/reconcile";
import { currentAddress, NotFound, route } from "@/lib/session";

type Ctx = { params: Promise<{ code: string }> };

/**
 * The whole polla, for whoever holds the link.
 *
 * Reading needs no session: the standings, the pot and the history are open to
 * the group. What the viewer proved they are only changes which predictions
 * come back before the deadline, and which buttons the UI can offer.
 *
 * Each read also nudges the Horizon sweep (rate-limited in lib/reconcile.ts),
 * so simply opening the polla is what makes a paid entry show up.
 */
export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { code } = await ctx.params;
  const polla = await findPolla(code);
  if (!polla) throw new NotFound("No encontramos esa polla.");

  if (polla.status === "open") {
    // A sweep that fails (Horizon down, no network) must not take the page
    // with it: the polla still reads fine from what is already recorded.
    await syncEntries(polla).catch(() => undefined);
  }

  return Response.json({
    polla: await loadPolla(polla, await currentAddress()),
  });
});
