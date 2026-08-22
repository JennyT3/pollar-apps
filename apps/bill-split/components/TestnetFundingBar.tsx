"use client";

import { usePollar } from "@pollar/react";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/Button";

/**
 * Testnet USDC/XLM needed to pay a share come from the dashboard's
 * distribution rules, not a faucet we build ourselves — this is the SDK's
 * own claim flow (`openDistributionRulesModal`). Shown wherever someone
 * might need to fund their wallet before paying: the spike and the real
 * split page.
 */
export function TestnetFundingBar() {
  const { openDistributionRulesModal, openEnabledAssetsModal } = usePollar();
  return (
    <div className="flex flex-col gap-3">
      <BalanceCard />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={openEnabledAssetsModal}
          className="self-start"
        >
          Manage assets (trustlines)
        </Button>
        <Button
          variant="secondary"
          onClick={openDistributionRulesModal}
          className="self-start"
        >
          Get testnet funds
        </Button>
      </div>
    </div>
  );
}
