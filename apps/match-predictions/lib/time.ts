/**
 * Dates as the group reads them.
 *
 * Everything is stored as an epoch millisecond and rendered in the reader's own
 * timezone: the deadline is one instant for everybody, and a player in Santa
 * Cruz and one visiting abroad should each see the wall-clock time their phone
 * shows them. The locale is fixed to es-BO for the wording.
 */

const LOCALE = "es-BO";

export function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  });
}

/** "en 2 h 15 min", "en 3 días", "hace 5 min". Coarse on purpose. */
export function relativeTo(epochMs: number, now: number = Date.now()): string {
  const diff = epochMs - now;
  const past = diff < 0;
  const abs = Math.abs(diff);

  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let value: string;
  if (minutes < 1) value = "menos de un minuto";
  else if (hours < 1) value = `${minutes} min`;
  else if (days < 1) value = `${hours} h ${minutes % 60} min`;
  else value = days === 1 ? "1 día" : `${days} días`;

  return past ? `hace ${value}` : `en ${value}`;
}

/**
 * Epoch ms → the value a `datetime-local` input wants, in local time.
 * `toISOString` is UTC, so the offset has to come off first or the form opens
 * showing a different hour than the one that was saved.
 */
export function toDateTimeLocal(epochMs: number): string {
  const local = new Date(epochMs - new Date(epochMs).getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** `datetime-local` value → epoch ms, or null when it isn't a date. */
export function fromDateTimeLocal(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
