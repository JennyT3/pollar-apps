import { headers } from "next/headers";

/**
 * The origin this request came in on, derived from the request itself rather
 * than an env var — a QR printed from the Vercel deploy has to encode the
 * Vercel URL, and one printed from localhost the local one, with no
 * configuration either way. Keeping this out of `.env` is also what lets the
 * app run from a fresh clone with only the Pollar key set.
 *
 * TRUST ASSUMPTION: `x-forwarded-host` and `x-forwarded-proto` are only
 * trustworthy behind a proxy that overwrites them. Vercel does, and so does
 * any sane ingress. Directly exposed, they are attacker-controlled — a
 * request to the print page carrying `X-Forwarded-Host: attacker.example`
 * would produce a physical sign whose QR sends diners to that host instead.
 *
 * That matters more here than in most places, because the output is printed
 * and taped to a table: nobody re-checks a sign once it is on the wall.
 *
 * Deploying this anywhere other than a platform that controls those headers
 * means either putting it behind such a proxy, or replacing this function
 * with an allowlist of expected hosts.
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function menuUrl(origin: string, code: string): string {
  return `${origin}/m/${code}`;
}
