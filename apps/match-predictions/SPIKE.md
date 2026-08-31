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

Testnet transactions captured while running the loop above, both of them through
the app itself rather than through `/spike`. Every hash opens on
[stellar.expert testnet](https://stellar.expert/explorer/testnet).

### One entry, one payout (polla `8MYA4T`)

The blocking criterion on its own: two Pollar accounts, entry 5 USDC, scoring
3/1. The player joined from the invite link, paid, and loaded predictions before
the deadline; after it passed the organizer entered results, closed the polla,
and confirmed the prefilled payout.

| Kind | Amount | Ledger | Hash |
| --- | --- | --- | --- |
| Entry | 5.0000000 USDC | 4406152 | [`7da3d3dd…acc8`](https://stellar.expert/explorer/testnet/tx/7da3d3dd1c7ed718262b9539d664f158fdeb6104256d1a38a06a1552d87aacc8) |
| Payout | 5.0000000 USDC | 4406434 | [`4c8429c0…d059`](https://stellar.expert/explorer/testnet/tx/4c8429c07f3a6bd0c98049b0c634390ba1a26b3051258804bba466062591d059) |

The pot round-trips exactly. The player held 20 USDC before the run; the entry
moved 5 to the organizer and the payout returned 5, leaving both accounts at
20 USDC with the difference visible only in XLM fees. Nothing is retained
anywhere, which is the claim the app makes on its own home screen.

### Three players and a split pot (polla `62USM5`)

The demo run, recorded: <https://youtu.be/K6e8M6z6mps>. Entry 5 USDC, scoring
3/1, three players joining a 15 USDC pot, one of them by scanning the QR from a
phone.

| Player | Bolívar 2-1 The Strongest | Always Ready 0-0 Wilstermann | Points |
| --- | --- | --- | --- |
| Nico | 2-1, exact | 1-0, miss | **3** |
| Rodri | 0-2, miss | 0-0, exact | **3** |
| Mica | 3-1, outcome | 2-0, miss | 1 |

Nico and Rodri finished level at the top, so the pot was divided rather than
handed over: `winnersOf` returned both, `splitPot` cut 15 USDC into two shares of
7.5000000, and the organizer confirmed two separate payments.

| Kind | Player | Amount | Ledger | Hash |
| --- | --- | --- | --- | --- |
| Entry | Nico | 5.0000000 USDC | 4407081 | [`1cff826a…cf8d`](https://stellar.expert/explorer/testnet/tx/1cff826a596d13ac7ad8a3282752a12296c9290b7df188344daaa90f4973cf8d) |
| Entry | Rodri | 5.0000000 USDC | 4407105 | [`09990e7d…228b`](https://stellar.expert/explorer/testnet/tx/09990e7d50565ddc09d2a3c1ee6a2f05ace681854395d685c7c1a4f21cc7228b) |
| Entry | Mica | 5.0000000 USDC | 4407105 | [`09338b49…b80b`](https://stellar.expert/explorer/testnet/tx/09338b49d488520e73b414c3c226b95666fd410448e6575a1969542f29d9b80b) |
| Payout | Nico | 7.5000000 USDC | 4407418 | [`ce1c2f61…00f7`](https://stellar.expert/explorer/testnet/tx/ce1c2f61c4b732bea5768d68d58c2f5edd08f756b39a304133a0402860ab00f7) |
| Payout | Rodri | 7.5000000 USDC | 4407419 | [`84623b26…9cc3`](https://stellar.expert/explorer/testnet/tx/84623b262034b38efdbc2f293ef10d0416412fbbe9b51c872e0142fa4d909cc3) |

This is the case a run rarely produces and the payout has to survive, so it is
worth stating that it happened on the ledger and not only in `lib/money.test.ts`:
three entries in, two payouts out, and the shares adding back up to exactly the
pot.

Every check listed above passes on all seven: `successful: true`, the payment
lands in the expected account, the amount matches in stroops, the asset is USDC
issued by `GBBD47IF…FLA5`, the memo is the entry's or payout's own reference, and
the payer is the account expected to pay.

## What the run turned up

**A player needs their own XLM.** The first attempt at the entry failed with
"Not enough XLM to cover the network fee" on a wallet holding 20 USDC and 0 XLM.
The account's reserves were sponsored (`num_sponsored: 4`), which is what the
template's "fee covered by the app" copy refers to, but a reserve and a
transaction fee are different things. Both transactions above confirm it: in each
one `fee_account` equals `source_account`, so neither was fee-bumped and each
payer spent 100 stroops of their own.

The fix is in the dashboard, not in the code: give new wallets a starting XLM
balance under **Treasury → Account Funding**, and enable `payment` under
**Treasury → Sponsorship**. An existing wallet is topped up from **Users →
Wallets → Fund 2 XLM**. The same failure is recorded in the qr-menu-orders
template (`apps/qr-menu-orders/docs/spike.md`), so it is a property of the
platform's defaults rather than of this app. It is repeated in the README because
it hits a player on their very first entry, which is the worst moment for the app
to look broken.

**The pot round-trips exactly.** The player held 20 USDC before the run. The
entry moved 5 to the organizer and the payout returned 5, leaving both accounts
at 20 USDC, with the difference visible only in XLM fees. Nothing is retained
anywhere, which is the claim the app makes on its own home screen.
