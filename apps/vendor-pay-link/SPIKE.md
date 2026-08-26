# Spike — charging loop on Stellar testnet

Blocking criterion from issue #9: two Pollar accounts, both QR kinds, one-confirmation pay, vendor balance updates, app records each payment **with its hash**.

## What we validated

| Check | Result |
|-------|--------|
| Two Pollar test accounts (vendor + buyer) | Yes — login with Pollar (Google / email). Vendor names the puesto; buyer never types a `G…` address. |
| Per-sale QR (fixed amount + optional note) | `/pay/c/{chargeId}` — amount prefills, one confirm, `runTx('payment', …)` |
| Stall QR (open amount) | `/pay/s/{publicCode}` — buyer types the amount, same payment path |
| Printable stall QR | `/print` — vendor name + large QR, nothing else |
| Incoming payment detected | Buyer `onSuccess` → `POST /api/sales/{id}/confirm`. Server verifies the hash on Horizon testnet (destination = vendor, amount, memo `P-{saleId}`). Backup: vendor polls `fetchTxHistory` and `POST /api/sales/match`; each hash is verified the same way (client amounts are ignored). |
| Hash stored and explorer-verifiable | `sale.txHash` persisted in Neon Postgres (Vercel) or `data/store.json` (local); UI “Ver comprobante” → stellar.expert testnet |

## Why QRs are app URLs, not SEP-7 / raw G-addresses

Pollar SEP-7 receive URIs are not the primary product path, and the bounty forbids typing a `G…` address as the main flow.

Each QR encodes a **deep link into this app**:

- Stall (open): `{origin}/pay/s/{publicCode}`
- Per-sale (fixed): `{origin}/pay/c/{chargeId}`

The page loads vendor name (and amount/note when fixed), then pays with the template payment flow (`runTx('payment', { destination, amount, asset }, { memo })`). Memo is `P-{saleId}` (≤28 chars) so we can correlate on our side even though Pollar history does not return memo.

## Detection (Horizon, not client trust)

Pollar `TxHistoryRecord` exposes `id`, `hash`, `summary`, `status`, `createdAt` — **not** memo or counterparty. The backup path therefore sends candidate **hashes** to the server. The server loads the transaction from Horizon testnet and only marks a sale paid if:

- the tx succeeded
- a `payment` operation destination is the vendor account
- the amount matches the sale
- the text memo is `P-{saleId}`

Duplicate pays: `POST /api/sales/{id}/claim` locks the sale before `runTx`; `release` on failure; confirm rejects a second hash.

## Testnet hashes captured during development

Verified on [stellar.expert testnet](https://stellar.expert/explorer/testnet). These are real `payment` txs recorded by the app (`sale.txHash`):

| Kind | Amount | Hash |
|------|--------|------|
| Stall (open amount, buyer typed 1) | 1 | [`aa86703547026ab4c7766a33a80fc2e12c0b3394e8edafae3a87c02b58189cc1`](https://stellar.expert/explorer/testnet/tx/aa86703547026ab4c7766a33a80fc2e12c0b3394e8edafae3a87c02b58189cc1) |
| Per-sale (fixed) | 2 | [`bd8079e36963b7d4032d5992a514d0b7df7fed1ad50d8db7a51ed8029fe200e2`](https://stellar.expert/explorer/testnet/tx/bd8079e36963b7d4032d5992a514d0b7df7fed1ad50d8db7a51ed8029fe200e2) |
| Per-sale (fixed) | 5 | [`dc9f73a3152370f3459e5b9425b3b97fa4360cf13d9432a48bd9ccdf75c7ec9a`](https://stellar.expert/explorer/testnet/tx/dc9f73a3152370f3459e5b9425b3b97fa4360cf13d9432a48bd9ccdf75c7ec9a) |
| Per-sale (fixed) | 5 | [`803bbe0c86901539010266272d7b12aa120e0a8a9f57ddf82275bfe47d17f8aa`](https://stellar.expert/explorer/testnet/tx/803bbe0c86901539010266272d7b12aa120e0a8a9f57ddf82275bfe47d17f8aa) |

Stall row: paid through `/pay/s/{publicCode}` (buyer entered the amount). Per-sale rows: `/pay/c/{chargeId}`. Both use `runTx('payment', …)` + Horizon confirm. Reproduce at `/spike` with two browsers.

## Reproduce

```bash
cd apps/vendor-pay-link
cp .env.example .env   # NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_…
pnpm install
pnpm dev
```

Open `/spike` and follow the in-app checklist. Demo of the full QR flow (phones in Bolivia): https://youtu.be/XTzV7j3caEY
