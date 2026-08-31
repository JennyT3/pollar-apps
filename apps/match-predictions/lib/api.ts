/**
 * Talking to this app's own API from the browser.
 *
 * One helper so every screen handles a failed request the same way: the server
 * always answers with `{ error }` on a non-2xx, and that message is written for
 * the player, so it is what gets thrown.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    // Same-origin cookies carry the signed-in session.
    credentials: "same-origin",
    headers:
      json === undefined
        ? rest.headers
        : { "content-type": "application/json", ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
    cache: "no-store",
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "No se pudo completar la operación.";
    throw new ApiError(message, res.status);
  }

  return body as T;
}
