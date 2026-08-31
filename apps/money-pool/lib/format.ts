/** "0.0000000" → "0.00", "12.5000000" → "12.50". Falls back to the raw string. */
export function formatAmount(value: string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "GDDH372S…203WJY": keeps both ends, trims the middle. */
export function middleTruncate(value: string, start = 8, end = 6): string {
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export function shortAddress(address: string) {
  return middleTruncate(address, 4, 4);
}

/** Formats a decimal string amount to 2 decimal places for display. "45.5000000" → "45.50" */
export function formatPoolAmount(amount: string | null): string {
  if (!amount) return "0.00";
  const parts = amount.split(".");
  const intPart = parts[0] || "0";
  const fracPart = parts[1] || "";
  const paddedFrac = (fracPart + "00").slice(0, 2);

  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${paddedFrac}`;
}
