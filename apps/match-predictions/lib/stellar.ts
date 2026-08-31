/**
 * Stellar / Horizon constants for this app.
 *
 * None of it is secret: Horizon is a public read-only API and an asset issuer
 * is public information, so none of it belongs in `.env`: the app has to run
 * with only the Pollar key configured.
 */

/** Public Horizon instance for testnet. No API key, no auth. */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/**
 * Circle's USDC on Stellar testnet: the asset this app settles in, and the
 * one enabled for the app in the Pollar dashboard (Treasury → Tokens &
 * Trustlines). Every entry and every payout is checked against this exact
 * code + issuer pair, so a payment in some other asset can never mark an
 * entry as paid.
 */
export const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
} as const;

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}

/** Stellar's fixed precision: 7 decimals, so 1 unit = 10_000_000 stroops. */
export const STROOPS_PER_UNIT = 10_000_000n;

/**
 * Decimal string → integer stroops.
 *
 * Money is compared and divided as integers everywhere in this app. Horizon
 * returns "5.0000000" where the app stored "5", and a pot split three ways is
 * exactly the kind of arithmetic that float rounding gets wrong.
 *
 * @throws {RangeError} if the string is not a plain non-negative decimal with
 *   at most 7 decimal places.
 */
export function toStroops(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new RangeError(`Not a Stellar amount: ${value}`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(`${whole}${(frac + "0000000").slice(0, 7)}`);
}

/** Integer stroops → the 7-decimal string Stellar and Pollar expect. */
export function fromStroops(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = (stroops % STROOPS_PER_UNIT).toString().padStart(7, "0");
  return `${whole}.${frac}`;
}

/** Loose G-address check; Horizon and the SDK do the real validation. */
export function looksLikeAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}
