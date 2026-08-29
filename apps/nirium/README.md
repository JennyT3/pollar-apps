# Nirium x402 adapter

Log in with Pollar, pay $0.02 USDC, get one real API call from [Nirium](https://nirium.xyz) — no XLM, no seed phrase, no manual wallet funding.

## What this demonstrates

Nirium's public API charges per request over [x402](https://developers.stellar.org/docs/build/agentic-payments/x402) (HTTP 402): each call to `GET /api/v1/premium/signals` costs $0.02 USDC, settled on Stellar testnet before the response is returned. A Pollar wallet can pay it directly — no separate Nirium account, no extra funding step:

1. `usePollar().getClient()` gives the logged-in user's `PollarClient`.
2. [`nirium-pollar-adapter`](https://www.npmjs.com/package/nirium-pollar-adapter)'s `createPollarSigner()` wraps `PollarClient.signAuthEntry()` (Pollar's own SDK method for signing a Soroban auth entry) into the SEP-43 signer x402 expects.
3. `createNiriumAdapter({ signer, network: "stellar:testnet" }).x402Fetch(url)` does the rest: request → `402` → sign → retry → `200`, one function call.

Pollar's sponsored trustline and the x402 facilitator's sponsored network fee mean a brand-new wallet with 0 XLM can complete this — verified end-to-end on Horizon before writing this app (see the linked GrantFox issue below).

This is why the payment isn't wired through `<PayButton>` or `SendModal`: those call `runTx('payment', …)`, a classic Stellar payment to another Pollar user. x402 is a different, equally first-class Pollar primitive (`signAuthEntry`, not `runTx`) for authorizing a Soroban contract invocation — there's no P2P recipient here, the counterparty is Nirium's facilitator.

## Setup

1. `cp .env.example .env`
2. Paste your Pollar publishable key into `.env` (`pub_testnet_…` — this app is testnet-only)
3. `pnpm install`
4. `pnpm dev`

Log in, then hit **Pay $0.02 & fetch**. The response panel shows the settlement tx hash (linked to Stellar Expert) and the JSON Nirium returned.

## Scope

Built for [pollar-xyz/pollar-apps#19](https://github.com/pollar-xyz/pollar-apps/issues/19). The adapter fix this issue also required (Deferred-mode wallet funding, `activateWallet()`) shipped separately in [nirium-pollar-adapter#1](https://github.com/nirium-protocol/nirium-pollar-adapter/pull/1) — not needed in this app's payment path, since the spike proved a 0-XLM wallet already completes a real payment without it.
