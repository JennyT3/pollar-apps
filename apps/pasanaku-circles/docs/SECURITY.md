# Payment verification

`confirmPayment` is the only path that credits a round. The client can lie. Horizon cannot.

A row is written only when every gate passes:

1. `payer` is a `G…` address
2. `payer` is a member
3. the circle is not `completed`
4. `payer !==` the current recipient (self-pay cannot close a round)
5. Horizon `successful === true`
6. the transaction has exactly one `payment` operation (`path_payment_*` is rejected)
7. `op.from === payer` (A's hash cannot be posted as B)
8. `op.to ===` the current recipient
9. amount matches in stroops (7 decimals, not floats)
10. asset is not native XLM
11. `asset_code === USDC`
12. `asset_issuer` is Circle testnet USDC (`STELLAR_USDC_ISSUER`, default `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`)
13. `memo_type === id`
14. memo equals `memoIdFor(circleId, round, payer)`
15. `tx_hash` is unique across the whole database (a hash from circle A cannot credit circle B)
16. `(circle_id, round, payer)` is unique

The pay button never falls back to XLM if the USDC balance has not loaded.

See `docs/diagrams/output/04-payment-verification.png`.
