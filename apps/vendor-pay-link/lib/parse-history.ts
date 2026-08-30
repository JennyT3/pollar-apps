/**
 * Best-effort parse of Pollar txHistory `summary` strings.
 * Documented examples look like "Sent 10.00 USDC"; incoming rows typically
 * read "Received …". Amount matching is the fallback when memo is absent
 * from the history API (see README).
 */
export function parseReceivedAmount(summary: string): string | null {
  const m = summary.match(
    /(?:received|recibido|recibiste)\s+([\d]+(?:\.[\d]+)?)\s*(?:USDC|XLM)?/i
  );
  if (m) return m[1];
  // Some summaries omit the verb and just show "+1.50 USDC"
  const plus = summary.match(/\+\s*([\d]+(?:\.[\d]+)?)\s*(?:USDC|XLM)/i);
  return plus ? plus[1] : null;
}
