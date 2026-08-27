# La Polla

The polla your group already runs on WhatsApp and a spreadsheet, with the money
part working. An organizer sets up a matchday: the fixtures, the entry, the
prediction deadline and the scoring. Everyone joins by scanning a QR and paying
their entry in USDC, one confirmation, no address to type. Predictions freeze at
kickoff, the standings move with every result the organizer enters, and when the
polla closes the app prepares the payout to the winner as a prefilled payment the
organizer confirms.

Every entry and every payout is a real USDC payment on Stellar testnet through
Pollar, and each one is recorded with the hash that proves it.

> Built on the pollar-apps template for issue
> [#14](https://github.com/pollar-xyz/pollar-apps/issues/14).

## Run it from a fresh clone

```bash
git clone https://github.com/<your-user>/pollar-apps
cd pollar-apps/apps/match-predictions
cp .env.example .env
# paste your publishable key: dashboard.pollar.xyz → Build → API Keys → Generate
pnpm install
pnpm dev
```

That is the whole setup. The only value you must fill is
`NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`; the database creates and migrates itself on
the first request.

### Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | yes | Your `pub_testnet_…` key. Also selects the network: the SDK reads testnet from the key prefix. |
| `DATABASE_URL` | only to deploy | libSQL/Turso URL. Unset, the app uses a local SQLite file at `./data/polla.db`. |
| `DATABASE_AUTH_TOKEN` | only to deploy | Token for that database. |

Horizon and the USDC issuer are not environment variables. Horizon is a public
read-only API and an issuer is public information, so both live in
`lib/stellar.ts` where they can be read.

### Database

Persistence is libSQL through Drizzle. Locally it is a file, created and migrated
on the first request, so nothing has to be set up by hand. On a deploy the
filesystem is ephemeral and read-only, so `DATABASE_URL` must point at a
libSQL/Turso database and migrations run once at deploy time:

```bash
pnpm db:generate   # after changing db/schema.ts
pnpm db:migrate    # against DATABASE_URL
pnpm db:studio     # browse it
```

Tables: `pollas`, `matches`, `entries`, `predictions`, `payouts`, plus
`sync_state` (the Horizon cursor per polla) and `sessions` / `challenges` for
sign-in. See `db/schema.ts`.

## How it works

### The app never holds money

There is no app account and no escrow. Entries are payments from each player
straight into the organizer's Pollar account, and the payout is a payment from
the organizer to the winner. What the app does is keep the ledger of who paid
what, compute the standings, and prepare the payout with the winner and amount
already filled in. Every figure it shows can be checked against Stellar by
anyone in the group.

### Joining by QR

The QR encodes a link into this app, `/{origin}/p/{code}/unirse`, not a raw
`G…` address and not a SEP-7 URI. Scanning it opens the join screen with the
polla, the organizer's account and the entry amount already in place; the player
puts in the name the group will see and confirms one payment. Typing an address
by hand is never part of the flow.

The payment itself goes through `runTx('payment', …)`, the same SDK call behind
the template's `PayButton` and `SendModal`, with one addition: a Stellar
`MEMO_ID` carrying that entry's reference. See `components/polla/PayWithMemo.tsx`.

### How entries are detected, and the limits

There are no client-side webhooks in the Pollar SDK, so detection is polling. It
runs on two paths, and an entry counts only when the ledger agrees:

1. **The player's browser reports the hash** right after paying. The hash is
   treated as a hint, not a fact: the server loads it from Horizon and only marks
   the entry paid if the transaction succeeded, a `payment` operation lands in the
   organizer's account, the amount matches the entry to the stroop, the asset is
   the expected USDC, the memo is that entry's reference, and the payer is that
   player. See `lib/horizon.ts`.

2. **A sweep of the organizer's account**, cursored, matching incoming payments
   by memo, amount, asset and payer. This catches every payment the browser never
   reported: a tab closed on the "sending" screen, a phone that lost signal, a
   battery that died between signing and reporting. See `lib/reconcile.ts`.

**Why Horizon and not the SDK's history.** `fetchTxHistory` returns the
transactions of the *logged-in* account, and a `TxHistoryRecord` carries `id`,
`hash`, `status`, `operation`, `summary` and an untyped `details` bag. Polled by
the organizer it would not show a payment somebody else submitted, and it exposes
no counterparty and no memo in its type, so it could not say which entry a
payment settles. Horizon publishes exactly that, publicly and read-only. The
`/spike` page prints what `fetchTxHistory` actually returns, so this is checkable
rather than asserted.

**The limits, stated plainly:**

- It is polling, not push. An entry is detected on the next pass, not the instant
  it lands. In practice that is a few seconds.
- A pass runs when someone opens the polla, presses the join screen's wait loop,
  or the open polla auto-refreshes. If nobody is watching, nothing is swept until
  the next person looks. No background job runs.
- Passes are rate-limited to one every 4 seconds per polla, so a page full of
  viewers does not hammer Horizon.
- Detection is per polla, against the organizer's account. A payment to that
  account without a matching memo belongs to somebody else and is left alone.
- Horizon being unreachable degrades to "not detected yet", never to a wrong
  answer: the read still works and the sweep retries.

### Predictions and the deadline

Predictions are editable until the deadline and frozen after it, and the deadline
is compared against the **server** clock, so moving a phone's clock forward
changes nothing. Before the deadline the server sends each player only their own
predictions, not even to the organizer; after it, everyone's are public next to
the result and the points they earned. That is enforced in `lib/queries.ts`, not
in the UI, so there is nothing to peek at in the payload.

A match left blank is worth nothing. That beats forcing a 0-0 nobody believes in.

### Scoring

Declared when the polla is created and applied automatically. The defaults are
the usual ones, 3 for an exact score and 1 for the right outcome, and the group
can set any pair as long as an exact hit is worth at least as much as an outcome
(otherwise a vaguer guess could beat a perfect one).

| Prediction against the final score | Points |
| --- | --- |
| Exact score | `exactPoints` |
| Right winner, or a draw, wrong score | `outcomePoints` |
| Wrong outcome | 0 |
| No prediction | 0 |

The standings are recomputed from the results on every read, never stored, so a
corrected score corrects the table with it. Ordering is total and deterministic:
points descending, then address ascending. Address order decides display order
only. Players on equal points share a rank, competition style, and the exact and
outcome counts are shown as detail, never as a tiebreak. See `lib/scoring.ts`.

### The payout

Closing the polla is one deliberate step and it needs every result in:

1. A final forced sweep of the organizer's account, so a player who paid while
   the last match was ending is counted before anything is frozen.
2. The pot is fixed at `entry × paid entries` and stored, so a payment landing
   afterwards cannot change what the winners were already owed.
3. The winners are everyone tied on the top score. The pot is split between them
   in integer stroops: equal shares, and the remainder (always fewer stroops than
   there are winners, so at most 0.0000001 USDC each) goes one stroop at a time in
   ascending address order. The shares always add back up to exactly the pot.
4. Each share becomes a *prepared* payment. The organizer confirms it from their
   own wallet and the hash is verified against Horizon before the winner shows as
   paid.

Two cases worth stating because they involve real money:

- **Nobody scored a single point.** There is no winner to reward, so the pot goes
  back: it is divided equally among everyone who paid. It never stays with the app
  or, silently, with the organizer.
- **The winner is the organizer.** The money is already in the right account, so
  the payout is recorded as `kept` rather than invented as a transfer. It appears
  in the history as exactly that.

Money is integer stroop arithmetic end to end (`lib/money.ts`, `lib/stellar.ts`).
Nothing about a pot is ever computed in floating point.

### Who is allowed to do what

Pollar signs the user in on the client, but nothing in that session can be
verified by a server, so an address arriving in a request body proves nothing. In
a polla that matters more than usual: the whole premise is that you cannot edit
your bet after the goal, and that only the organizer enters results.

So the app asks for a proof. The account signs a short server-issued challenge
under **SEP-53** (`client.stellar.sep53.signMessage`), the server verifies that
signature against the address with `@stellar/stellar-base`, and only then issues a
session cookie. The cookie is a random token stored as a SHA-256 hash, so a leaked
row cannot be replayed. Challenges are single-use and expire in five minutes. See
`lib/session.ts` and `hooks/useAppSession.ts`.

Reading needs none of it. The standings, the pot and the history are open to
whoever holds the link.

One limitation to know: SEP-53 needs a classic ed25519 key, so a smart (passkey)
wallet with a `C…` address cannot sign in for writes. Custodial Pollar accounts,
which is what a Google or email login gives you, sign server-side with nothing to
confirm.

## Screens

| Route | What it is |
| --- | --- |
| `/` | Your pollas, or what a polla is. Also takes a code to jump straight in. |
| `/nueva` | Create one: fixtures, entry, deadline, scoring. |
| `/p/{code}` | The polla. Standings first, then predictions, movements and, for the organizer, the controls. |
| `/p/{code}/unirse` | Where the QR lands you: pay the entry, one confirmation. |
| `/spike` | The money loop on its own, with the ledger checks printed. See [SPIKE.md](./SPIKE.md). |

## Checking the work

```bash
pnpm lint          # clean
pnpm build         # typechecks and builds
```

The API was also driven end to end against a running dev server, signing every
write with a real SEP-53 signature from generated keypairs: sign-in and its
refusals (wrong key, reused nonce), creating a polla and its validation, joining
and the memo reference, an unpaid player being kept out of the pot and out of
predictions, prediction privacy before the deadline, the organizer-only routes
refusing players, the scoring, competition ranking, settling and its refusals,
the tie split down to the odd stroop, and the everybody-missed refund. The one
thing that exercise cannot fake is a real payment, which is what the spike is
for.

## Deploy

1. Create a libSQL/Turso database and run `pnpm db:migrate` against it.
2. Set `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`, `DATABASE_URL` and
   `DATABASE_AUTH_TOKEN` in the Vercel project.
3. Deploy, then put the production URL in `pollar.manifest.json` and in
   `apps.json`.
