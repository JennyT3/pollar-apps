import { NextResponse } from "next/server";

/**
 * Wraps a route handler so an unexpected failure (e.g. the database being
 * unreachable) always comes back as JSON, matching every other response
 * this API returns — never Next's default HTML error page, which would
 * break `res.json()` on the client with an unhandled parse error.
 */
export function apiRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
