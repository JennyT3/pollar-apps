# Spike: the money loop on testnet

The blocking criterion of issue #14, on its own, before any of the app around
it: two Pollar accounts, an entry paid by QR and detected, a payout prepared and
confirmed, both hashes captured.

It lives at `/spike` in the running app so it can be repeated by anyone with two
test accounts and a browser, and so the ledger checks are visible rather than
described.

## What is being proved

| Step | How | Where |
| --- | --- | --- |
| The app generates the entry QR: organizer's account, entry amount, reference to the polla | The QR encodes `/{origin}/p/{code}/unirse`, and that screen builds the payment from the polla | `components/polla/InviteQr.tsx`, `components/polla/JoinScreen.tsx` |
| The player pays with one confirmation through the template's payment flow | `runTx('payment', { destination, amount, asset }, { memo: { type: 'id', value } })`, the same SDK call as `PayButton` and `SendModal`, plus the memo | `components/polla/PayWithMemo.tsx` |
| The app detects it and marks the player as in, capturing the hash | The browser reports the hash and the server verifies it on Horizon; independently, a cursored sweep of the organizer's account matches by memo | `lib/horizon.ts`, `lib/reconcile.ts` |
| The app prepares the payout as a prefilled payment the organizer confirms in one step, capturing that hash too | Settling writes a `prepared` payout with the winner and the exact share; the organizer confirms it, and the hash is verified the same way | `app/api/pollas/[code]/settle/route.ts`, `app/api/pollas/[code]/payouts/confirm/route.ts` |

## The checks a payment has to pass

Nothing is marked as paid on a browser's word. For every hash, entry or payout,
the server loads the transaction from public Horizon and requires all of:

1. The transaction succeeded on the network.
2. A `payment` operation lands in the expected account.
3. The amount matches, compared in integer stroops rather than as decimals.
4. The asset is USDC with the expected issuer, not another asset with the same
   code.
5. The text of the memo is `id:<reference>`, the one this entry or payout carries.
6. The payer is the expected account.

`/spike` runs these against any hash and prints every check with what it expected
and what the ledger actually said, including the failures. A made-up hash, a
payment of the wrong amount, a payment in another asset and a payment to another
account all fail here, visibly.

## Reproduce it

```bash
cd apps/match-predictions
cp .env.example .env      # NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_…
pnpm install
pnpm dev
```

Two browsers or two profiles, so two Pollar accounts are logged in at once: one
organizer, one player. Fund the player's account with testnet USDC.

**1. The entry.** In the player's browser, open `/spike`, section 1. Put the
organizer's `G…` address as the destination, the entry amount, and leave the
generated reference. Pay. The hash appears with the six checks under it, all
green.

**2. The payout.** In the organizer's browser, open `/spike`, section 2. Put the
player's address, the pot amount, and pay. Same checks, same result.

**3. What the SDK's history returns.** Section 3 calls `fetchTxHistory` and
prints the records raw. This is the evidence behind detecting entries on Horizon
instead: the records belong to the account that is logged in and carry no
counterparty and no memo, so they cannot say which player settled which entry.

The same loop through the real app, rather than the spike page: create a polla at
`/nueva`, open the QR from the "Organizar" tab, scan it from the player's phone,
pay, watch the entry register; then enter results, close the polla, and confirm
the prefilled payout.

## Runs

Testnet transactions captured while running the loop above. Every hash opens on
[stellar.expert testnet](https://stellar.expert/explorer/testnet).

| Kind | Amount | Hash |
| --- | --- | --- |
| Entry | | |
| Payout | | |

> To be filled with the hashes from the run, and with the demo video, before the
> PR is opened. Nothing goes in this table that was not produced by an actual
> payment on testnet.
