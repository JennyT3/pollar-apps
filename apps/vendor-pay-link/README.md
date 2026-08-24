# Puesto (`vendor-pay-link`)

QR charging for informal vendors in Bolivia (caseritas, food carts, ferias), built for [pollar-apps#9](https://github.com/pollar-xyz/pollar-apps/issues/9).

The vendor logs in with Pollar, names the puesto, and gets a **permanent stall QR** (buyer types the amount) plus **per-sale QRs** (fixed amount + optional note, two taps). The buyer scans, pays USDC on Stellar **testnet** through the Pollar SDK, and the sale appears in **today’s sales** / **history** with an explorer link. No store, no website, no paperwork. The buyer never types a `G…` address.

Demo video (setup, printable QR, fixed + open scans, list updating): [`Pollar QR Link.mp4`](./Pollar%20QR%20Link.mp4)

## Fresh clone

```bash
cd apps/vendor-pay-link
cp .env.example .env
# dashboard.pollar.xyz → Build → API Keys → publishable `pub_testnet_…`
pnpm install
pnpm dev
```

Only env required: `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`. JSON persistence is created automatically at `data/store.json`.

Production deploy: https://pollar-qr-link.vercel.app

This repo is a **monorepo**. In Vercel, set **Root Directory** to `apps/vendor-pay-link` (the root has no Next.js app). Also set `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` in the Vercel project env. Optional: `NEXT_PUBLIC_APP_URL=https://pollar-qr-link.vercel.app` so QR links stay absolute.

## Vendor UI (two primary screens + history)

1. **Cobrar** — permanent stall QR + generator for a per-sale QR (amount + note).
2. **Hoy** — today’s count, total, and list (time, amount, note, explorer link).
3. **Historial** (`/historial`) — every paid sale (timestamp, amount, note, hash via explorer).

Printable stall QR: **`/print`** (puesto name + large QR only — meant to be taped to the counter).

Spike checklist: **`/spike`**.

## QR kinds

| Kind | Path | Behavior |
|------|------|----------|
| Permanent stall | `/pay/s/{publicCode}` | Open amount — buyer enters what they owe |
| Per-sale | `/pay/c/{chargeId}` | Fixed amount + optional note |

QRs encode **this app’s URLs**, not raw Stellar addresses. Scan → Pollar login if needed → one confirmation → `runTx('payment', …)` (same path as the template PayButton / SendModal). Memo `P-{saleId}`.

## Incoming payment detection

No client-side webhooks in the SDK.

1. **Primary:** buyer `onSuccess` → `POST /api/sales/{id}/confirm` `{ txHash }`. Sale becomes `paid` without the vendor doing anything.
2. **Backup:** while the vendor is logged in and `verified`, `usePaymentDetection` polls `fetchTxHistory` (~8s), parses received amounts from `summary`, `POST /api/sales/match`.

Anti double-pay: `claim` before submit, `release` on failure, confirm rejects a second hash.

### Limits

- History API gives `summary` + `hash`, **not** memo or counterparty. Backup match is **by amount**.
- Two pending sales with the same amount can collide on backup match; the buyer callback avoids this.
- If the buyer closes the tab before `onSuccess` and history `summary` is not parseable, the sale can stay `pending` until a later poll.
- Polling requires the vendor session (history is the logged-in user).

## Persistence

JSON file `data/store.json` (vendors, charges, sales). Survives reload and `pnpm dev` restart. On Vercel the filesystem is ephemeral — swap `lib/db.ts` for Postgres/Turso using the same types in `lib/types.ts` for durable production.

## Stack (template pins)

- Next.js 16 App Router, React 19, TypeScript 5, Tailwind 4
- `@pollar/core@^0.11.2`, `@pollar/react@^0.11.2` (same pins as `template/`)
- `qrcode.react` for QR images
- Pollar auth / balance / `runTx` are **not** reimplemented

UI copy shows **USD** (USDC under the hood). No XLM, swap, or wallet-address primary flow.

## Acceptance (issue #9)

- [x] Spike: fixed + open QR, two Pollar accounts, hashes recorded — see `SPIKE.md`
- [x] Permanent stall QR + printable `/print`
- [x] Per-sale amount + note in two taps
- [x] Buyers pay by scanning; real testnet payments
- [x] App marks sales paid without vendor action
- [x] Today’s sales: count, total, list
- [x] History with hashes / explorer links
- [x] `pnpm install && pnpm dev` + Pollar key only
- [x] SDK pins match the template
- [x] Demo video (Bolivia QR flow on phones): `Pollar QR Link.mp4`
