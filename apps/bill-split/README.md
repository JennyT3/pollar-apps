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
That's the only required value.

```bash
pnpm install
pnpm dev
```

Log in, hit **+ New split**, and go — no database account needed to run
this locally, see **Database** below.

## Database

Splits and their participants live behind one small interface
(`lib/db.ts`), backed by two interchangeable drivers, same schema either
way:

- **Local dev (default)**: no configuration needed. A local SQLite file at
  `data/bill-split.db` (via `@libsql/client`, the same dialect Turso
  speaks), created automatically the first time the app touches the
  database.
- **Production**: a local file doesn't survive on serverless hosting
  (Vercel's functions have no persistent disk between invocations), so
  production points at [Neon](https://neon.tech) Postgres instead, via its
  serverless HTTP driver (`@neondatabase/serverless`) — no connection pool
  to manage.

Which one runs is decided by a single env var:

1. Leave `DATABASE_URL` unset → local SQLite file. This is the default,
   and what a fresh clone gets with nothing but the Pollar key in `.env`.
2. Set `DATABASE_URL` to a Neon connection string (sign up at
   [neon.tech](https://neon.tech), free tier is plenty, copy **Connection
   string** from the dashboard — looks like
   `postgresql://user:password@host/dbname?sslmode=require`) → Postgres.
   Set this in your deploy environment's variables for production.

The schema (`CREATE TABLE IF NOT EXISTS …`) is applied automatically the
first time the app touches the database, whichever driver is active — no
manual migration step, in either environment.

## Payment verification

A participant's share isn't marked paid just because the client says so.
After `runTx('payment', …)` returns a hash, the client sends it to
`POST /api/splits/[id]/pay`, and the server independently checks it against
Stellar's public testnet Horizon API (`GET
/transactions/{hash}/operations`) before recording anything — confirming a
real payment operation exists for that hash, **from** the claimed payer,
**to** the split's collector address, in the split's asset, for at least
the participant's share. No Pollar key involved in that check; it's the
public Stellar network.

A few things this specifically guards against, since this is a payments
app and it's worth being explicit:

- **A spoofed payer.** Checking `from` (not just `to`/asset/amount) means
  nobody can take someone else's real hash and claim it under their own
  address — the sender on-chain has to match who's claiming the payment.
- **Hash reuse.** A unique index on `tx_hash` (partial: `NULL`s excluded,
  so unpaid rows don't collide with each other) means one real payment can
  never be recorded against two different participants, in this split or
  any other.
- **A double-pay race.** Recording a payment is a single conditional
  `UPDATE … WHERE paid_at IS NULL RETURNING id` — if two requests for the
  same share land at once, only one can win; the loser gets a 409, not a
  second, silently-ignored payment.
- **Payments after close.** A closed split (auto- or manually closed)
  rejects further `pay` calls outright, even if a request was already
  in flight.

A tampered, unrelated, or already-used hash gets rejected with a 409/422,
not silently ignored — the client surfaces the server's error.

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

Reading one back doesn't depend on the phone's own camera app: **Scan QR**
on the home page opens the device camera and decodes locally with `jsqr`
— no upload, no network call — and only ever navigates same-origin. A QR
that resolves to another domain is refused, not followed.

## The spike

`/spike` is a minimal, standalone page kept in the repo as the reproducible
proof that the QR → payment → captured hash loop works end to end between
two different Pollar accounts on testnet — the blocking spike this app's
issue required before the full build. It's linked from the home page
footer. It doesn't use the database; it's a plain payment test, independent
of the split flow above.

**Spike result:** a real testnet payment triggered by opening a QR-encoded
link, hash
[`618e0ba56f8117bf954993d431c113e6fe55a7c59bea8f239c523623d617b95d`](https://stellar.expert/explorer/testnet/tx/618e0ba56f8117bf954993d431c113e6fe55a7c59bea8f239c523623d617b95d),
confirmed successful directly against Horizon.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript 5, Tailwind 4
- `@pollar/react` / `@pollar/core` for auth, balance and payments — never
  reimplemented, always the SDK's own `runTx`
- `@libsql/client` (local SQLite) / `@neondatabase/serverless` (Postgres,
  via Neon) for persistence — see **Database** above
- `@stellar/stellar-base` to verify SEP-53 signatures server-side
- `qrcode.react` for QR generation, `jsqr` for the in-app scanner

## Deploy

1. Push to a GitHub repo, import it into [Vercel](https://vercel.com).
2. Set the environment variables: `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` and
   `DATABASE_URL` (see **Database** above).
3. Deploy, then put the resulting URL in `pollar.manifest.json`.
