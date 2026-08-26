"use client";

import type { PollarClient } from "@pollar/core";
import { authMessage, PUESTO_PROOF_HEADER } from "./auth-message";

type Cached = { exp: number; signature: string; address: string };

const cache = new Map<string, Cached>();
const TTL_MS = 4 * 60 * 1000;

async function proofFor(
  client: PollarClient,
  address: string
): Promise<Cached> {
  const hit = cache.get(address);
  if (hit && hit.exp - 30_000 > Date.now()) return hit;
  const exp = Date.now() + TTL_MS;
  const message = authMessage(address, exp);
  const signed = await client.stellar.sep53.signMessage(message);
  if (signed.status !== "signed") {
    throw new Error(
      signed.details ?? "No se pudo firmar la sesión Pollar"
    );
  }
  const next: Cached = {
    address: signed.signerAddress || address,
    exp,
    signature: signed.signature,
  };
  cache.set(address, next);
  return next;
}

/** fetch() that attaches a SEP-53 proof of the logged-in Pollar address. */
export async function pollarFetch(
  client: PollarClient,
  address: string,
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const proof = await proofFor(client, address);
  const headers = new Headers(init.headers);
  headers.set(PUESTO_PROOF_HEADER, JSON.stringify(proof));
  return fetch(input, { ...init, headers });
}
