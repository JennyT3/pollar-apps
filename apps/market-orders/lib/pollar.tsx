"use client";

import { PollarClient } from "@pollar/core";
import { PollarProvider } from "@pollar/react";
import "@pollar/react/styles.css";

const publishableKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY;

const globalPollar = globalThis as { __pollarClient?: PollarClient };

function getPollarClient(key: string): PollarClient {
  globalPollar.__pollarClient ??= new PollarClient({
    apiKey: key,
    stellarNetwork: key.startsWith("pub_mainnet_") ? "mainnet" : "testnet",
  });
  return globalPollar.__pollarClient;
}

export function PollarAppProvider({ children }: { children: React.ReactNode }) {
  if (!publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY is not set. Copy .env.example to .env and paste your publishable key from dashboard.pollar.xyz."
    );
  }

  return (
    <PollarProvider client={getPollarClient(publishableKey)}>
      {children}
    </PollarProvider>
  );
}
