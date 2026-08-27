# Spike — one BOB → USDC → GHS payment, testnet, end to end

Blocking criterion from issue #17: one account funded through the Bolivian ramp, USDC moved via the Pollar SDK, payout triggered on the Ghana side and confirmed. A reproducible script plus the transaction hashes of each leg.

## Status: code path complete, not yet run with real funds

This is the honest state of things, not a claim of a finished spike:

| Check | Status |
|-------|--------|
| Morapay quote/execute wired up (`lib/morapay/`, `app/api/morapay/[...path]/route.ts`) | Done |
| DIY Bolivia onramp wired up (`fetchRampQuotes` / `submitRampOrder` in `app/page.tsx`), pointed at Morapay's returned Stellar address | Done |
| Onramp polling → confirm → payout polling, chained automatically | Done |
| Typechecks / lints clean | Done (see below) |
| Actually run once, testnet, with a funded Bolivia test account and a real Ghana MoMo recipient, hashes captured | **Not done yet** |

I don't have Morapay testnet merchant keys, a funded Bolivia-side test identity, or a real Ghana MoMo number to receive a payout — those need to come from whoever runs this spike next (you, or the assigned developer). This file is the checklist and reproduction steps for doing that run; it is not standing in for having done it.

## Reproduce

```bash
cd apps/bolivia-ghana-corridor
cp .env.example .env
# NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_…
# MORAPAY_PUBLIC_KEY=… / MORAPAY_SECRET_KEY=… (Morapay merchant dashboard, testnet)
pnpm install
pnpm dev
```

1. Log in with a Pollar test account.
2. Enter an amount (BOB) and a Ghana MoMo recipient (phone, name, provider).
3. **Get quote** → **Start transfer**. If Morapay returns a hosted QR (`payment.kind: "fiat_rail_deposit"` with `scannable`), that's the whole flow — scan and pay, then watch the status poll. If it returns a Stellar fallback instead (the expected case today, see README's "Why the DIY path"), the app moves to picking a Bolivia onramp route.
4. Select a route, fill in whatever fields that provider requires, **Generate Bolivia QR**.
5. Scan and pay the BOB amount. The app polls the onramp until Pollar hands back a Stellar tx hash, then automatically calls `bridge/confirm`.
6. Watch the final poll until `COMPLETED` (or `FAILED` with a `failureCode`/`failureMessage`, in which case check whether it failed before or after `bridge/confirm` — see README's "Failure handling").

## Capturing hashes for this file

Once a real run completes:

- The Stellar tx hash (from the ramp transaction's `stellarTxHash`, same value passed to `bridge/confirm`) is verifiable at `https://stellar.expert/explorer/testnet/tx/<hash>`.
- The `bridgeTransferId` (== the original quote's `quoteId`) and `momoReference` from the final `COMPLETED` response are Morapay's own record of the fiat leg.

Replace this section with the real table once that run has happened:

| Leg | Value | Explorer |
|-----|-------|----------|
| Bolivia onramp (BOB → USDC) | _pending real run_ | — |
| Morapay bridge (USDC → GHS payout) | _pending real run_ | — |
