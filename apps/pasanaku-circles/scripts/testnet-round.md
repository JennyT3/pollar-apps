# Opt-in testnet round

`pnpm test:e2e` never hits Stellar. It uses a mock Horizon.

To run a real round:

1. `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_…`
2. Two or three Pollar testnet accounts funded with USDC + XLM
3. Save Playwright `storageState` sessions to `e2e/.auth/` after logging in (gitignored)
4. `POLLAR_E2E=1 pnpm test:e2e:testnet`

Until those sessions exist the spec skips.

Manual equivalent (what the spike asks for):

```bash
pnpm dev
```

Open `/spike` on two devices. Paste B's `G…` address, amount `1`, scan from A's phone, confirm. Paste the hash into `SPIKE.md` and the PR.
