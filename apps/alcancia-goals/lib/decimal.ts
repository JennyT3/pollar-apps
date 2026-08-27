/**
 * Fixed-point decimal helpers for money amounts, stored and passed around as
 * strings (Stellar amounts use 7 decimal places, e.g. "12.5000000"). Scaling
 * by 1e7 and doing the math in BigInt avoids float drift on repeated
 * set-asides/contributions.
 */
const SCALE = 10_000_000n;

function toScaled(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const [whole, frac = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");
  const paddedFrac = (frac + "0000000").slice(0, 7);
  const scaled = BigInt(whole || "0") * SCALE + BigInt(paddedFrac || "0");
  return negative ? -scaled : scaled;
}

function fromScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Sums an array of decimal strings, returning a decimal string. */
export function sumAmounts(values: string[]): string {
  return fromScaled(values.reduce((acc, v) => acc + toScaled(v), 0n));
}

/** a - b as a decimal string. */
export function subtractAmounts(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}

/** Compares two decimal strings: negative if a<b, 0 if equal, positive if a>b. */
export function compareAmounts(a: string, b: string): number {
  const diff = toScaled(a) - toScaled(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export function isPositiveAmount(value: string): boolean {
  return /^\d+(\.\d{1,7})?$/.test(value.trim()) && toScaled(value) > 0n;
}

/** Clamp a progress ratio (saved/target) to [0, 1], target<=0 treated as 0%. */
export function progressRatio(saved: string, target: string): number {
  const t = toScaled(target);
  if (t <= 0n) return 0;
  const s = toScaled(saved);
  const ratio = Number(s) / Number(t);
  return Math.max(0, Math.min(1, ratio));
}
