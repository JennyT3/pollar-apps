# Spike — one BOB → USDC → GHS payment, end to end

Blocking criterion from issue #17: one account funded through the Bolivian ramp, USDC moved via the Pollar SDK, payout triggered on the Ghana side and confirmed. A reproducible script plus the transaction hashes of each leg.

## Status

| Check | Status |
|-------|--------|
| Morapay quote/execute wired up (`lib/morapay/`, `app/api/morapay/[...path]/route.ts`) | Done |
| DIY Bolivia onramp wired up (`fetchRampQuotes` / `submitRampOrder` in `app/page.tsx`), pointed at Morapay's returned Stellar address | Done |
| Onramp polling → confirm → payout polling, chained automatically | Done |
| Typechecks / lints clean | Done (see below) |
| The underlying Pollar ramp ↔ Stellar mechanism this app builds on, live with real funds | **Done** — see below |
| A full run through *this app's own UI* end to end, with hashes captured here | Pending — next section |

The Bolivia-side ramp leg (Pollar SDK onramp/offramp, real USDC on Stellar mainnet) is not unproven infrastructure: it has already been exercised live, with real money, in the sibling integration this corridor reuses. One verified example, independently confirmed on Horizon (not just trusted from app state):

- Tx hash: [`719e906bb4086fb42743877824a686458e4000df61ca5c6932ae03cbc103bdf0`](https://stellar.expert/explorer/public/tx/719e906bb4086fb42743877824a686458e4000df61ca5c6932ae03cbc103bdf0)
- 2.19 USDC (issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`, Circle's official Stellar USDC issuer), `successful: true`, ledger 64139478
- What's left to run through *this specific app* is the same mechanism wired end to end with a Ghana MoMo recipient on the other side, and to capture that run's hashes in this file.

Each transaction a user runs through this app is recorded in their own **Transaction history** (account menu → `components/HistoryModal.tsx`, backed by `lib/history.ts`) — that's per-user confirmation, by design, not a public ledger. Whoever runs the next full pass through this app's UI will see their own record there, and can paste the resulting hashes into the table below.

## Reproduce

```bash
cd apps/bolivia-ghana-corridor
cp .env.example .env
# NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_mainnet_… (or pub_testnet_… to dry-run without moving real funds)
# MORAPAY_PUBLIC_KEY=… / MORAPAY_SECRET_KEY=… (Morapay merchant dashboard)
pnpm install
pnpm dev
```

1. Log in with a Pollar account.
2. Enter an amount (BOB) and a Ghana MoMo recipient (phone, name, provider).
3. **Get quote** → **Start transfer**. If Morapay returns a hosted QR (`payment.kind: "fiat_rail_deposit"` with `scannable`), that's the whole flow — scan and pay, then watch the status poll. If it returns a Stellar fallback instead (the expected case today, see README's "Why the DIY path"), the app moves to picking a Bolivia onramp route.
4. Select a route, fill in whatever fields that provider requires, **Generate Bolivia QR**.
5. Scan and pay the BOB amount. The app polls the onramp until Pollar hands back a Stellar tx hash, then automatically calls `bridge/confirm`.
6. Watch the final poll until `COMPLETED` (or `FAILED` with a `failureCode`/`failureMessage`, in which case check whether it failed before or after `bridge/confirm` — see README's "Failure handling").

## Capturing hashes for this file

Once a run through this app's own UI completes:

- The Stellar tx hash (from the ramp transaction's `stellarTxHash`, same value passed to `bridge/confirm`) is verifiable at `https://stellar.expert/explorer/public/tx/<hash>` (or `.../testnet/tx/<hash>` for a testnet dry run).
- The `bridgeTransferId` (== the original quote's `quoteId`) and `momoReference` from the final `COMPLETED` response are Morapay's own record of the fiat leg.
- The user's own **Transaction history** panel in the app shows the same record.

Replace this table with the real values once that run happens:

| Leg | Value | Explorer |
|-----|-------|----------|
| Bolivia onramp (BOB → USDC) | _fill in from the next full run_ | — |
| Morapay bridge (USDC → GHS payout) | _fill in from the next full run_ | — |
