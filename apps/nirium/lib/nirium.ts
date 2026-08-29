import type { PollarClient } from "@pollar/core";
import { createNiriumAdapter, createPollarSigner } from "nirium-pollar-adapter";
import { decodePaymentResponseHeader } from "@x402/core/http";

/**
 * Nirium's x402 endpoints are a Soroban `transfer` invocation authorized by a
 * signed auth entry (SEP-43) — not a classic Stellar payment. There is no
 * `runTx('payment', …)` equivalent for this: `PollarClient.signAuthEntry()`
 * (the same SDK method createPollarSigner wraps here) is Pollar's own
 * first-class primitive for exactly this shape of request, so this is not a
 * hand-rolled submission path around the SDK.
 */
const TESTNET_ENDPOINT = "https://nirium-agent.fly.dev/api/v1/premium/signals";

/** One adapter per PollarClient, same one-instance-per-key discipline as lib/pollar.tsx. */
const globalNirium = globalThis as {
  __niriumAdapter?: ReturnType<typeof createNiriumAdapter>;
};

function getNiriumAdapter(pollar: PollarClient) {
  globalNirium.__niriumAdapter ??= createNiriumAdapter({
    signer: createPollarSigner(pollar),
    network: "stellar:testnet",
  });
  return globalNirium.__niriumAdapter;
}

export interface NiriumSignalsResult {
  /** Raw JSON body Nirium's endpoint returned once payment settled. */
  data: unknown;
  /** Settlement tx hash, read off the payment receipt header set by the facilitator. */
  txHash: string | null;
}

/**
 * Pays $0.02 USDC (testnet, sponsored network fee) for one live signal from
 * Nirium's public x402 endpoint, and returns the response plus the
 * settlement hash if the facilitator exposed one.
 */
export async function fetchNiriumSignal(
  pollar: PollarClient
): Promise<NiriumSignalsResult> {
  const nirium = getNiriumAdapter(pollar);
  const res = await nirium.x402Fetch(TESTNET_ENDPOINT);
  if (!res.ok) {
    throw new Error(`Nirium request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  // @x402/fetch exposes the settlement receipt as a base64 header — the
  // facilitator's own SettleResponse, not a custom field Nirium invented.
  // CORS-exposed under both cases (@x402/core sets Access-Control-Expose-Headers
  // to the mixed-case form; plain fetch normalizes header names to lowercase).
  const responseHeader =
    res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
  const txHash = responseHeader
    ? decodePaymentResponseHeader(responseHeader).transaction
    : null;
  return { data, txHash };
}

export const NIRIUM_TESTNET_ENDPOINT = TESTNET_ENDPOINT;
