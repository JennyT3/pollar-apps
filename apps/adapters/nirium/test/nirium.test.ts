import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { PollarClient } from "@pollar/core";
import { encodePaymentResponseHeader } from "@x402/core/http";
import { fetchNiriumMarket, NIRIUM_TESTNET_ENDPOINT } from "../lib/nirium";

/**
 * fetchNiriumMarket() itself is what this repo owns: wiring
 * createPollarSigner()/createNiriumAdapter() together, then reading the
 * settlement hash back off the real x402 response header. The signer
 * translation those two functions do (Pollar session -> SEP-43 auth entry)
 * already has its own 10-case suite against real Soroban XDR in
 * nirium-pollar-adapter/test/signer.test.mjs (commit 7adc4756) — this file
 * doesn't repeat that, it covers what's specific to this app instead.
 *
 * getNiriumAdapter() in lib/nirium.ts caches its adapter on
 * `globalThis.__niriumAdapter` with `??=`, which only evaluates
 * createNiriumAdapter()/createPollarSigner() when that slot is empty. Every
 * test here pre-fills the slot with a fake adapter before calling
 * fetchNiriumMarket(), so the real network/signer path never runs and the
 * `pollar` argument is never touched — a plain `{}` cast stands in for it.
 */
const globalNirium = globalThis as {
  __niriumAdapter?: { x402Fetch: (url: string) => Promise<Response> };
};

const FAKE_POLLAR = {} as PollarClient;

function fakeAdapter(x402Fetch: (url: string) => Promise<Response>) {
  globalNirium.__niriumAdapter = { x402Fetch };
}

beforeEach(() => {
  delete globalNirium.__niriumAdapter;
});

test("returns the response body and settlement hash from PAYMENT-RESPONSE", async () => {
  const settleResponse = {
    success: true,
    transaction:
      "744645331a8d70b27d86425b8fb2c97a9967e618218c8232136a5a238c7722d6",
    network: "stellar:testnet" as const,
    payer: "GBI5YGW6LVLH5QARPQJ24SEISBRU7QT2ROZNNYB35NID6SWDRQCHKUDH",
  };
  const header = encodePaymentResponseHeader(settleResponse);

  fakeAdapter(async (url) => {
    assert.equal(url, NIRIUM_TESTNET_ENDPOINT);
    return new Response(JSON.stringify({ xlmPrice: 0.42 }), {
      status: 200,
      headers: { "PAYMENT-RESPONSE": header },
    });
  });

  const result = await fetchNiriumMarket(FAKE_POLLAR);
  assert.deepEqual(result.data, { xlmPrice: 0.42 });
  assert.equal(result.txHash, settleResponse.transaction);
});

test("falls back to the lowercase X-PAYMENT-RESPONSE header", async () => {
  // Plain fetch (unlike @x402/fetch, which is what's actually wired in
  // lib/nirium.ts) normalizes header names to lowercase — this is the case
  // the ?? fallback in fetchNiriumMarket() exists to cover.
  const header = encodePaymentResponseHeader({
    success: true,
    transaction: "abc123",
    network: "stellar:testnet",
  });

  fakeAdapter(async () => {
    const headers = new Headers();
    headers.set("x-payment-response", header);
    return new Response("{}", { status: 200, headers });
  });

  const result = await fetchNiriumMarket(FAKE_POLLAR);
  assert.equal(result.txHash, "abc123");
});

test("returns a null hash when the response carries no settlement header", async () => {
  fakeAdapter(async () => new Response("{}", { status: 200 }));

  const result = await fetchNiriumMarket(FAKE_POLLAR);
  assert.equal(result.txHash, null);
});

test("throws on a non-2xx response instead of returning it as data", async () => {
  fakeAdapter(
    async () => new Response("payment invalid", { status: 402, statusText: "Payment Required" })
  );

  await assert.rejects(
    () => fetchNiriumMarket(FAKE_POLLAR),
    /Nirium request failed: 402 Payment Required/
  );
});

test("reuses the same adapter instance across calls (singleton, not re-created per request)", async () => {
  let callCount = 0;
  fakeAdapter(async () => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  });

  const cached = globalNirium.__niriumAdapter;
  await fetchNiriumMarket(FAKE_POLLAR);
  await fetchNiriumMarket(FAKE_POLLAR);

  assert.equal(callCount, 2, "x402Fetch runs once per call");
  assert.equal(
    globalNirium.__niriumAdapter,
    cached,
    "getNiriumAdapter() never replaces the cached instance"
  );
});
