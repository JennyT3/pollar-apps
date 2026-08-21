# Bill Split

Split a bill with friends and settle each share by QR on Pollar. One person
pays the table, creates a split, and everyone else pays their part straight
from their Pollar wallet — no typing addresses, no spreadsheets, no chasing
people down.

Built on the Pollar SDK (Stellar testnet, USDC): every payment is a real
on-chain transaction, verifiable by its hash.

## How it works

1. **Create a split** — total amount, a description, and who's in. Split it
   equally or set a custom amount per person.
2. **Share it** — one QR code / link per split. Drop it in the group chat.
3. **Pay your share** — whoever opens the link logs in with Pollar (if they
   aren't already) and taps their own name to pay. No address typed, no
   manual entry — that's the whole point of the QR.
4. **Watch it settle live** — the page polls for updates, so paid/pending
   status and the running total update for everyone looking at the link.
5. **Close** — the split closes itself once everyone's paid, or the
   collector can close it manually at any point.

Every paid row keeps the payer's address, the timestamp, and the transaction
hash, linked out to Stellar's testnet explorer so it's independently
verifiable.

## Setup

```bash
cp .env.example .env
```

Paste your Pollar publishable key into `.env` — get it at
[dashboard.pollar.xyz](https://dashboard.pollar.xyz) under **Build → API
Keys → Generate** (type: Publishable, `pub_testnet_…` while developing).

You also need a database connection string — see **Database** below,
it's a two-minute signup.

```bash
pnpm install
pnpm dev
```

Log in, hit **+ New split**, and go.

## Database

Splits and their participants live in Postgres, via
[Neon](https://neon.tech) and its serverless HTTP driver
(`@neondatabase/serverless`) — no connection pool to manage, which is what
makes it work cleanly on serverless hosting (a plain local SQLite file
doesn't survive between invocations there). The same `DATABASE_URL` is used
locally and in production — no separate driver, no migration step, no local
file to keep track of.

1. Sign up at [neon.tech](https://neon.tech) (free tier is plenty) and
   create a project.
2. Copy its connection string from the dashboard (**Connection string**,
   looks like `postgresql://user:password@host/dbname?sslmode=require`).
3. Paste it as `DATABASE_URL` in `.env` (locally) and in your deploy
   environment's variables (production).

The schema (`CREATE TABLE IF NOT EXISTS …`) is applied automatically the
first time the app touches the database — no manual migration step, in
either environment.

## Payment verification

A participant's share isn't marked paid just because the client says so.
After `runTx('payment', …)` returns a hash, the client sends it to
`POST /api/splits/[id]/pay`, and the server independently checks it against
Stellar's public testnet Horizon API (`GET
/transactions/{hash}/operations`) before recording anything — confirming a
real payment operation exists for that hash, to the split's collector
address, in the split's asset, for at least the participant's share. No
Pollar key involved in that check; it's the public Stellar network. A
tampered or unrelated hash gets rejected with a 422.

## QR mechanics

Two QR codes exist in this app, both generated client-side with
`qrcode.react`:

- **The split's own QR** (`/split/[id]`) — encodes the split's URL. Scanning
  or opening it takes you straight to the split's live page, where you pick
  your name and pay.
- **The spike page** (`/spike`, see below) — encodes a URL with the
  destination, amount and reference as query params, used to prove the
  underlying payment loop before the real split flow was built on top of
  it.

## The spike

`/spike` is a minimal, standalone page kept in the repo as the reproducible
proof that the QR → payment → captured hash loop works end to end between
two different Pollar accounts on testnet — the blocking spike this app's
issue required before the full build. It's linked from the home page
footer. It doesn't use the database; it's a plain payment test, independent
of the split flow above.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript 5, Tailwind 4
- `@pollar/react` / `@pollar/core` for auth, balance and payments — never
  reimplemented, always the SDK's own `runTx`
- `@neondatabase/serverless` for persistence (Postgres, via Neon)
- `qrcode.react` for QR generation

## Deploy

1. Push to a GitHub repo, import it into [Vercel](https://vercel.com).
2. Set the environment variables: `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` and
   `DATABASE_URL` (see **Database** above).
3. Deploy, then put the resulting URL in `pollar.manifest.json`.
