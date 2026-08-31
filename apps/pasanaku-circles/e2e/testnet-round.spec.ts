import { test } from "@playwright/test";

/**
 * Opt-in live testnet round. Skips unless POLLAR_E2E=1 and a real
 * pub_testnet key plus saved Pollar sessions exist in e2e/.auth/.
 *
 * See docs/RECORDING.md and scripts/testnet-round.md.
 */
test("live testnet round", async () => {
  test.skip(
    process.env.POLLAR_E2E !== "1",
    "set POLLAR_E2E=1 and provide e2e/.auth storageState to run against testnet"
  );
});
