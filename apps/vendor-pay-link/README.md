# Puesto (`vendor-pay-link`)

Charging tool for informal vendors on Pollar (issue [#9](https://github.com/pollar-xyz/pollar-apps/issues/9)). Built for the Bolivian public: caseritas, food carts, ferias. Validated with real phones in Bolivia (see demo video).

The vendor logs in with Pollar, names the puesto, and gets a charging QR — no store, no website, no paperwork.

- **Permanent stall QR** (open amount: the buyer types what they owe). Printable and taped to the counter (`/print`: big QR + vendor name, nothing else).
- **Per-sale QR** (fixed amount + optional note) in two taps.

The buyer scans or opens the link, confirms once, and pays. Every payment is a **real USDC payment on Stellar testnet** through the Pollar SDK (`runTx('payment', …)`), into the vendor’s existing Pollar account (one balance across all Pollar apps). The vendor sees the sale land in **Hoy** without touching anything.

The buyer **never types a `G…` address**. QRs are app deep links.

Demo (vendor setup + printable view, buyer paying fixed-amount and open-amount by scanning, sales list updating):

https://youtu.be/XTzV7j3caEY

## Run from a fresh clone

This island uses **pnpm**, same as `template/` (`packageManager: pnpm@10.23.0`). That is the command the repo tests with:

```bash
cd apps/vendor-pay-link
cp .env.example .env
pnpm install
pnpm dev
```

Only env for local: `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_…`  
(dashboard.pollar.xyz → Build → API Keys → publishable).

Locally, sales persist in `data/store.json` if `DATABASE_URL` is unset. **Production uses Neon Postgres** (`DATABASE_URL` / `POSTGRES_URL`) so sales survive Vercel deploys.

Production URL (also in `pollar.manifest.json`): https://pollar-qr-link.vercel.app

## Two vendor screens (+ history)

1. **Cobrar (charge)** — stall QR + per-sale generator (amount + note).
2. **Hoy (today’s sales)** — count, total, list (time, amount, note, hash).
3. **Historial** (`/historial`) — every sale (timestamp, amount, note, hash) with stellar.expert link.

Printable stall QR: `/print`. Spike page: `/spike`.

## Both QR kinds

| Kind | Path | Behavior |
|------|------|----------|
| Permanent stall (open amount) | `/pay/s/{publicCode}` | Buyer types the amount |
| Per-sale (fixed) | `/pay/c/{chargeId}` | Amount + optional note prefills |

Prefill is done by loading vendor + sale from our API, then paying with the **template payment flow** (`PayButton` / `runTx('payment', …)`). Unexpected: Pollar history does not return memo, so we cannot match on memo from history — see detection below.

## Incoming payment detection (no client webhooks)

1. **Primary:** buyer `onSuccess` → `POST /api/sales/{id}/confirm` with `txHash`. The server checks Horizon (destination = vendor, **USDC** + Circle issuer, amount, memo `P-{saleId}`) before marking the sale paid.
2. **Backup (polling):** while the vendor is logged in and `verified`, `usePaymentDetection` polls `fetchTxHistory` (~8s) and `POST /api/sales/match` with candidate hashes. The server ignores client amounts and verifies each hash on Horizon the same way (native XLM is rejected).

### Limits

- Pollar history records expose `summary` + `hash`, **not** memo or counterparty. Confirmation never trusts the client hash blindly — Horizon must show a successful **USDC** payment to the vendor for that amount with memo `P-{saleId}`.
- The pay button stays disabled until `useBalance` has loaded USDC (no native-XLM fallback).
- If the buyer closes the tab before `onSuccess` and Horizon has not yet ingested the tx, the sale can stay `pending` until a later poll.
- Polling requires the vendor session (history is the logged-in user).

Double-pay: `claim` before `runTx`, `release` on failure, confirm rejects a second hash.

## Persistence

- **Vercel / production:** Neon Postgres (`DATABASE_URL`). Tables are created on first request.
- **Local without Postgres:** `data/store.json` (gitignored). Same schema as the DB.

## Vendor API auth

The vendor `G…` address is public on-chain, so listing/renaming a puesto cannot be gated on that string alone. Pollar access tokens are DPoP-bound, so `POLLAR_SECRET_KEY` cannot introspect a Bearer token from the browser. Write endpoints (`POST /api/vendor`, `POST /api/charges`, `GET /api/sales`, `POST /api/sales/match`, claim/release/confirm) require a short-lived SEP-53 signature of the live Pollar session (`x-puesto-proof`). Public remain: stall/charge GET pages and `POST /api/sales` (buyer creating an open-amount sale).

## Stack

- Next.js 16 App Router, React 19, TypeScript 5, Tailwind 4 (template)
- `@pollar/core@^0.11.2`, `@pollar/react@^0.11.2` — same pins as `template/` (satisfies issue `^0.11.0`)
- `@neondatabase/serverless` for durable sales on Vercel
- `@stellar/stellar-base` to verify SEP-53 session proofs on the server
- `qrcode.react` for QR images
- Pollar auth, balance, session, payments: **not reimplemented**

## Acceptance (issue #9)

- [x] Spike: fixed-amount and open-amount QR between two Pollar accounts on testnet; hashes captured and detected — `SPIKE.md`, `/spike`
- [x] Permanent stall QR with clean printable view — `/print`
- [x] Per-sale charges with amount and note generate a QR/link in two taps
- [x] Buyers pay by scanning; real testnet payments land in the vendor’s Pollar balance
- [x] App detects incoming payments and marks each sale paid without the vendor touching anything
- [x] Today’s sales shows count, total, and the list of sales
- [x] Every sale is in history with hashes verifiable in the explorer
- [x] Runs from a fresh clone with `pnpm install && pnpm dev` plus only the Pollar API key in `.env`
- [x] Pins `@pollar/core@^0.11.0`, `@pollar/react@^0.11.0` (template: `^0.11.2`)
- [x] Demo video: QR flow with real users in Bolivia scanning from their phones — https://youtu.be/XTzV7j3caEY
- [x] Complete README + demo video attached to the PR
