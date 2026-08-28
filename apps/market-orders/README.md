# Market Orders

Pre-order and pay ahead to your casera, pick up without waiting in line.

## Setup

```bash
pnpm install
cp .env.example .env
# Add your pub_testnet_* key to .env
npx prisma db push
pnpm dev
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Yes | Pollar publishable key (`pub_testnet_...`) from [dashboard.pollar.xyz](https://dashboard.pollar.xyz) |
| `DATABASE_URL` | No | Defaults to `file:./dev.db` (SQLite) |

### Fresh clone

```bash
git clone https://github.com/JennyT3/pollar-apps.git
cd pollar-apps/apps/market-orders
pnpm install
cp .env.example .env
# Add your pub_testnet_* key to .env
npx prisma db push
pnpm dev
```

## Flow

The app is split into one screen per job:

**Casera** (logged in):
- `/` — Landing. Log in, then create the stall. Right after creation the admin key is shown **once**, with a save-it warning; it is never shown again.
- `/casera/menu` — Her list of the day: add items with price and quantity, adjust quantities during the day, "se acabó" in one tap.
- `/casera/board` — The board: pending orders, paid/ready orders (each hash links to stellar.expert), delivered, today's summary (orders + USDC collected) and history.
- `/casera/pickup` — Pickup verification: entering a code marks it delivered; a code that was already delivered is rejected (409).
- `/casera/settings` — Stall QR to print, the public URL, the owner address, and (only if the key was never saved on this device) a field to paste the admin key. The key itself is never displayed here.

**Customer** (`/stall/{id}`, no login required to browse) — Scan the QR code (or visit the URL). Browse the live menu which stops selling what ran out. Log in with Pollar, pick items, see the total, pay once with the Pollar SDK in USDC to the casera's account (address prefilled from the stall, never typed). Receive a pickup code + QR after the payment is verified.

### Currency: USDC only

Everything is USDC-denominated (testnet). The app never falls back to XLM or to another asset:

- The payment asset is resolved by asset code `USDC` from the wallet's balances; if the user's account has no USDC the app says so and disables paying.
- The on-chain verification rejects any payment that is not USDC with the testnet issuer.
- The board's day summary and history render in USDC; while the balance is loading it shows "…", never a wrong asset.

### Order states

1. **pending** — Stock reserved, awaiting payment
2. **paid** — Payment verified server-side via Stellar Horizon API
3. **ready** — Casera marks as prepared
4. **delivered** — Pickup verified with code
5. **cancelled** — Payment failed, stock restored
6. **expired** — Pending > 10 minutes, stock restored

## Payment detection

There are no webhooks. The customer's browser calls `runTx('payment', ...)` via the Pollar SDK and receives an immediate result (hash or error). The order is updated to PAID server-side with the tx hash.

### Server-side verification

When a txHash is submitted, the server:
1. Checks the hash hasn't been used on another order (unique constraint)
2. Fetches the transaction from Stellar Horizon testnet API
3. Verifies the memo matches the order's memo
4. Verifies the destination is the stall owner's address
5. Verifies the amount matches the order total

### Dual detection

Payment is detected two ways:
1. **Customer-side**: After `runTx` confirms, client sends PATCH with txHash
2. **Casera-side**: Board polls `fetchTxHistory` from Pollar SDK every 10s, matches pending order memos against recent transactions

### Limitations

- Detection depends on the SDK confirming the transaction (typically 2-5s on testnet)
- Casera-side detection polls every 10s (not real-time push)
- Rate limit: 1,000 requests/day on testnet (shared across all users)
- Horizon API may have brief delays during network congestion

## Pickup verification

- Only the stall owner can verify pickup — the backend looks up the order, then requires the caller's verified wallet to equal the stall owner
- First check: order marked DELIVERED, stock stays decremented
- Second check with same code: REJECTED (409 Conflict)
- Wrong stall's code: REJECTED (403 Forbidden)
- Each paid order gets a 6-character code + QR code

## Identity verification

The Pollar gateway's token endpoints cannot be validated server-side (the documented server API is offline and `/v2/auth/session/resume` requires a DPoP proof only the SDK client can sign). So, mirroring the reference `qr-menu-orders` app, the casera's identity is an offline admin token stored by the app itself:

1. On stall creation, the server generates an admin token (`ct_<40 chars>`) and returns it **once**, on the creation screen, with a "save it — it can't be recovered" warning. The UI stores it in localStorage and never displays it again.
2. Only its SHA-256 hash is stored on the `Stall` row — the raw token is never persisted server-side
3. Mutating endpoints (menu items, order status transitions, pickup, order list) require header `X-Admin-Token: <token>` and compare it with a timing-safe hash comparison
4. `POST /api/stall` with an owner address that already has a token returns `409 stall_exists` — the token is only issued once, at creation. Losing it means losing write access (the trade for not being able to verify a Pollar session server-side)
5. Payment verification is the customer's proof: `paid` requires only a `txHash`, verified server-side on Horizon (memo, destination = stall owner, USDC testnet, exact amount) — no admin token needed, so the customer can report payment after paying

## Order expiration

PENDING orders older than 10 minutes are automatically expired and stock is restored. The casera's board calls `/api/order/expire` every 30 seconds.

## How payments are detected

Orders are created PENDING with a server-generated reference that doubles as the Stellar transaction memo (`O<stall-prefix><timestamp><random>`). An order becomes PAID in two ways:

1. **Customer-confirmed + verified on-chain (primary).** After the SDK `runTx` returns, the customer reports the `txHash`. The server re-verifies it on Stellar Horizon: memo matches the order, destination is the casera's address, asset is testnet USDC, and the amount matches the order total (normalized to 7 decimals). Only then is the order marked PAID. A `txHash` is unique — submitting one that was already used returns `409`.
2. **Casera-side polling (fallback).** The board also polls the SDK transaction history every 10s and reports matching memos with the same endpoint, so a payment is detected even if the customer's confirmation is lost.

Limits: there are no client-side webhooks, so detection depends on either the customer's browser or the board's polling; both validate on-chain, and the unique hash guarantees an order cannot be double-paid. Horizon can lag a payment by a few seconds, so the verify step retries for a few seconds before failing.

## Spike (verified end to end)

Validated on testnet with two distinct Pollar accounts (casera and customer, different addresses — not a self-payment). Flow: the customer ordered items, paid in USDC with the order memo, the payment landed in the casera's account, the paid order appeared on the board with its pickup code, the first code check delivered it and a repeat was rejected with 409.

- Customer address: `G…` (different from the casera's)
- Order memo: `…`
- Amount: `X.0000000` USDC (testnet issuer)
- Transaction hash: `…` — https://stellar.expert/explorer/testnet/tx/…
- Video: <link when published>

## Database

SQLite via Prisma. Schema:

- `Stall` — id, ownerAddress (unique), name, ownerTokenHash (SHA-256 of the admin token)
- `MenuItem` — id, stallId, name, price, quantity, soldOut
- `Order` — id, stallId, customerAddress, total, status, txHash (unique), pickupCode, memo, timestamps
- `OrderItem` — id, orderId, menuItemId, name, price, quantity

The local SQLite database is created automatically on `pnpm install` (postinstall runs `prisma db push`). To reset: `rm prisma/dev.db && npx prisma db push`.

### Deploying to Vercel (Turso database)

Local development uses SQLite (`file:./prisma/dev.db`) via the libSQL driver adapter — zero extra config. For production:

1. Create a Turso database, then set in the **Vercel dashboard** (never in a committed `.env`):
   - `DATABASE_URL=libsql://<db>-<org>.turso.io`
   - `DATABASE_AUTH_TOKEN=<token>`
2. `prisma migrate` / `prisma db push` cannot connect directly to a `libsql://` URL (Prisma limitation). Create the tables once by generating SQL locally and applying it with the Turso CLI:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > turso-schema.sql

turso db shell <your-db-name> < turso-schema.sql
```
