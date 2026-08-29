"use client";

import { BalanceCard } from "@/components/BalanceCard";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { middleTruncate } from "@/lib/format";
import { NIRIUM_TESTNET_ENDPOINT } from "@/lib/nirium";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useNiriumPayment } from "@/hooks/useNiriumPayment";

/**
 * Nirium pays for its own API calls per-request over x402 (HTTP 402):
 * every call to this endpoint costs $0.05 USDC, settled on Stellar testnet
 * before the response is returned. This screen pays for and shows one call,
 * with a logged-in Pollar wallet doing the signing — no XLM needed, the
 * facilitator sponsors the network fee and Pollar sponsors the trustline.
 */
export default function Home() {
  const { user } = usePollarAuth();
  const { state, pay } = useNiriumPayment();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Nirium x402 adapter
            <span className="block text-primary">pay-per-call, live</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Log in with Pollar, then pay $0.05 USDC for one real API call to
            Nirium — no XLM, no wallet setup, no seed phrase.
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 lg:max-w-lg lg:py-10">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={30} />
          <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
            Nirium x402 adapter
          </h1>
        </div>
        <LoginButton />
      </header>

      <BalanceCard />

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">Pay for live market state</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            One request to Nirium&apos;s public x402 endpoint. $0.05 USDC,
            settled before the response comes back.
          </p>
          <p className="mt-1 font-mono text-xs text-muted-light">
            GET {NIRIUM_TESTNET_ENDPOINT}
          </p>
        </div>

        <Button
          onClick={() => void pay()}
          loading={state.status === "paying"}
        >
          {state.status === "paying" ? "Paying…" : "Pay $0.05 & fetch"}
        </Button>

        {state.status === "error" && (
          <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
            {state.message}
          </p>
        )}

        {state.status === "success" && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div>
              <span className="text-sm font-medium text-muted">
                What just happened
              </span>
              <p className="mt-1 text-sm leading-6">
                Pollar signed a Soroban auth entry authorizing $0.05 USDC.
                Nirium&apos;s facilitator verified and settled it, then
                returned the market state below — reference rates
                attributed to their source, not investment advice.
              </p>
            </div>

            {state.txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${state.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                {middleTruncate(state.txHash, 10, 8)} ↗
              </a>
            )}

            <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs leading-5">
              {JSON.stringify(state.data, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      <p className="mt-auto pt-4 text-center text-xs text-muted-light">
        Powered by{" "}
        <a
          href="https://www.npmjs.com/package/nirium-pollar-adapter"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          nirium-pollar-adapter
        </a>
        . Testnet — payments are real and verifiable, the money is not.
      </p>
    </main>
  );
}
