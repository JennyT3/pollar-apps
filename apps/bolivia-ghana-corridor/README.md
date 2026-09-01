# Bolivia → Ghana corridor

Issue: [pollar-xyz/pollar-apps#17](https://github.com/pollar-xyz/pollar-apps/issues/17)

Sends BOB from Bolivia and pays out GHS to a Ghanaian mobile money account, bridged through Stellar USDC. One direction ships first (BOB → GHS), per the issue's own allowance — the reverse leg (`GHS_TO_PESOS`) is documented below but not wired into the UI yet.

## The three legs

```
Bolivia payer scans a QR, pays BOB
        │  (Pollar ramp onramp, walletAddress = Morapay's address)
        ▼
USDC lands on Stellar, at an address Morapay controls
        │  (this app calls bridge/confirm with the resulting tx hash)
        ▼
Morapay sells/bridges the USDC and pays out GHS via mobile money
```

Each leg is confirmed independently, not assumed:

1. **Quote + execute** (`POST /api/morapay/bridge/quote`, `POST /api/morapay/bridge/execute`) — Morapay prices the BOB → GHS conversion and returns either a QR it hosts itself, or a Stellar payment instruction (see "Why the DIY path" below).
2. **Bolivia onramp** (`client.getRampsQuote` / `client.createOnRamp`, Pollar's own ramp SDK) — this app runs its own onramp with `walletAddress` pointed at the Stellar address Morapay's `execute` call returned. This is what actually generates the Bolivia-side QR the payer scans. The onramp is polled via `client.getRampTransaction` until it hands back a Stellar tx hash.
3. **Confirm + payout** (`POST /api/morapay/bridge/confirm`, `GET /api/morapay/bridge/status/:id`) — once the tx hash is in hand, this app calls Morapay's confirm endpoint. Morapay verifies the payment on Horizon, then pays out GHS mobile money. Status is polled until `COMPLETED` or `FAILED`.

## Why the DIY path

Morapay's bridge API documents two ways to run the Bolivia QR leg: **hosted** (Morapay runs its own Pollar session server-side and returns `payment.scannable` directly from `execute`) or **DIY** (the integrator runs their own Pollar onramp against the Stellar address Morapay hands back).

As of this integration, Morapay's hosted path is not reliably available: `/ramps/onramp` only accepts an end-user access token, not a server/secret key, so a backend-driven QR requires routing a synthetic ops user through email OTP and refreshing that session — a workaround, not a real server-side credential mode. This app therefore implements the **DIY path**: `executeBridge()` in `app/page.tsx` checks `payment.kind`, and falls back to running its own onramp (`fetchRampQuotes` → `submitRampOrder`) whenever Morapay doesn't hand back a hosted QR. If Morapay ships a server credential mode for this later, the hosted branch (already implemented, just rarely taken today) starts firing without any code change.

## Confirmation and its limits

- **On-chain leg**: verified by Morapay against Horizon (correct USDC asset, correct destination, amount within tolerance, memo when set) when `bridge/confirm` is called — not trusted from client state.
- **Bolivia onramp leg**: polled via `client.getRampTransaction` every 5s, up to ~7.5 minutes (`POLL_MAX_ATTEMPTS` in `app/page.tsx`). If the onramp hasn't produced a Stellar tx hash by then, polling stops and the UI is left showing the last known status — nothing is assumed to have failed silently.
- **GHS payout leg**: polled via `bridge/status/:id` on the same interval/cap. Morapay's own settlement rail can retry internally (Moolre first, Quidax fallback, per their docs) before reaching a terminal status.
- **Quotes expire**: Morapay bridge quotes and Pollar ramp quotes both have short TTLs. This app does not currently auto-refresh either — if `bridge/quote`'s `expiresAt` or a ramp quote passes before `execute`/`createOnRamp` is called, the next call fails and the user has to restart from the form. Worth adding a background refresh (existing precedent for this pattern lives in the sibling `pollar-backoffice` integration this app was ported from).

## Failure handling

If the payout leg fails **after** the on-chain leg already succeeded (`bridge/confirm` succeeded, then `status` later returns `FAILED` with e.g. `failureCode: "MOMO_PAYOUT_FAILED"` or `"QUIDAX_PAYOUT_FAILED"`), the UI on the `done` step calls this out explicitly: the crypto already moved and is with Morapay, so this is a payout-side failure, not something the user needs to (or should) retry from scratch. See the `bridgeResult.failureMessage` block in `app/page.tsx`.

If the Bolivia onramp itself fails or expires before producing a tx hash, no `bridge/confirm` call is ever made — Morapay's side stays at `AWAITING_CRYPTO` and no funds moved on either leg.

## Transaction history

The account menu (`components/AccountModal.tsx`) has a **Transaction history** entry opening `components/HistoryModal.tsx`. This is local-only (`lib/history.ts`, backed by `localStorage`), not server-synced — it exists so a user who navigates away or refreshes mid-transfer can find their in-flight transfer again and manually refresh its status. Records older than 24h are dropped automatically on read.

## Setup

```bash
cp .env.example .env
```

- `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` — from [dashboard.pollar.xyz](https://dashboard.pollar.xyz) (Build → API Keys), `pub_testnet_…` for development.
- `MORAPAY_PUBLIC_KEY` / `MORAPAY_SECRET_KEY` — from the Morapay merchant dashboard (Developers → API keys). Backend-only, read in `app/api/morapay/[...path]/route.ts`, never exposed to the browser.

```bash
pnpm install
pnpm dev
```

Log in with Pollar, fill in the amount and a Ghana MoMo recipient, and follow the flow.

## Spike status

See `SPIKE.md` for the blocking-criterion checklist and where it currently stands — the code path is complete and typechecks, but a real end-to-end run with funded testnet accounts and real testers on both ends has not been executed yet.

## Out of scope (this PR)

- `GHS_TO_PESOS` (reverse direction) — the bridge client and types already model it (`lib/morapay/client.ts`'s `execute` accepts `partnerStellarAddress`), but there's no UI for it yet.
- Mainnet — everything here targets testnet per the issue.
- KYC flows beyond what the ramp/bridge APIs surface directly (`kycUrl` is passed through if a provider returns one, not built out further).
