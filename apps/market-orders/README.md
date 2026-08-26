# Market Orders

Pre-order and pay ahead to your casera, pick up without waiting in line.

## How it works

**Casera** (`/`) — Login, create a stall, add menu items with prices and quantities. Print the QR code for your stall. When customers order, you see them appear in real-time (polling every 5s). Mark orders as "ready" when prepared. Verify pickup by entering the customer's 6-character code.

**Customer** (`/stall/{id}`) — Scan the QR code (or visit the URL). Browse the menu without logging in. Login with Pollar to pay. Select items, confirm, and pay via the Pollar SDK. Receive a pickup code after successful payment.

## Payment detection

There are no webhooks. The customer's browser calls `runTx('payment', ...)` via the Pollar SDK and receives an immediate result (hash or error). The order is updated to PAID server-side with the tx hash. The casera's board polls `/api/order` every 5s to see new paid orders.

**Limitations:**
- Detection depends on the SDK confirming the transaction (typically 2-5s on testnet)
- No real-time push — casera sees orders on next poll cycle
- Rate limit: 1,000 requests/day on testnet (shared across all users of this app)

## Order flow

1. Customer selects items → app validates stock → creates PENDING order (reserves stock)
2. Customer pays via Pollar SDK with memo = order reference
3. SDK confirms → order updated to PAID + tx hash stored
4. Casera marks order as "ready" when prepared
5. Customer shows pickup code → casera verifies → order marked DELIVERED

**Stock reservation:** Quantities are decremented when the PENDING order is created. If payment fails, the order is cancelled and stock is restored.

**Memo format:** `O{4-char stall prefix}{6-char timestamp}` — 11 chars max, well under Stellar's 28-byte limit.

## Pickup verification

- Only the stall owner can verify pickup (endpoint checks `callerAddress` matches `stall.ownerAddress`)
- First check: order marked DELIVERED, stock stays decremented
- Second check with same code: REJECTED (409 Conflict)
- Wrong stall's code: REJECTED (403 Forbidden)

## Order history

Casera board has two tabs:
- **Hoy**: pending, paid/ready, delivered orders for today
- **Historial**: all past orders with links to Stellar testnet explorer

## Setup

```bash
cp .env.example .env
# Paste your Pollar publishable key into .env
pnpm install
pnpm dev
```

Get your API key at [dashboard.pollar.xyz](https://dashboard.pollar.xyz) under **Build → API Keys → Generate** (type: Publishable, `pub_testnet_…`).

## Database

SQLite via Prisma. Schema:

- `Stall` — id, ownerAddress (unique), name
- `MenuItem` — id, stallId, name, price, quantity, soldOut
- `Order` — id, stallId, customerAddress, total, status, txHash, pickupCode, memo, timestamps
- `OrderItem` — id, orderId, menuItemId, name, price, quantity

Migrations run automatically on first request. To reset: `rm prisma/dev.db && npx prisma migrate dev`.

## Fresh clone

```bash
pnpm install
cp .env.example .env
# Add your pub_testnet_* key to .env
pnpm dev
```

Open http://localhost:3000 — login, create a stall, add items, print the QR.
