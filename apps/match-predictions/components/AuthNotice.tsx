"use client";

import { useEffect, useRef, useState } from "react";
import { usePollar } from "@pollar/react";
import type { AuthState } from "@pollar/core";

/**
 * Says out loud when a login fails, or when a session dies right after one.
 *
 * Two different silences are covered here, and both left a player staring at a
 * login button with no idea why.
 *
 * The first is a failed login. The SDK finishes an OAuth login by polling its
 * own API for the popup's session to turn ready, and when that never happens it
 * lands on `AuthState.step === 'error'` with a message and a code. Nothing
 * renders that by default, so the popup says "account authenticated", closes
 * itself, and the app looks untouched.
 *
 * The second is a session that is stored and then dropped seconds later. The SDK
 * clears a session when a request 401s and the refresh that follows also fails,
 * which reads to the user as "it let me in and then threw me out". That path
 * goes back to `idle`, not to `error`, so nothing is shown at all.
 *
 * Neither can be fixed from inside the app, but both can be named, which is the
 * difference between a broken app and a setting to go and check.
 */

/**
 * A session lost this soon after being granted was not a logout. Long enough to
 * cover the first authenticated calls, short enough that deliberately logging
 * out later never trips it.
 */
const DROPPED_WINDOW_MS = 30_000;

type Notice =
  | { kind: "error"; message: string; code: string }
  | { kind: "dropped" };

export function AuthNotice() {
  const { getClient } = usePollar();
  const [notice, setNotice] = useState<Notice | null>(null);
  /** When the session was last granted, to tell a drop from a logout. */
  const authenticatedAt = useRef<number | null>(null);

  useEffect(() => {
    // Fires immediately with the current state, then on every change, and
    // returns its own unsubscribe.
    return getClient().onAuthStateChange((state: AuthState) => {
      if (state.step === "error") {
        setNotice({ kind: "error", message: state.message, code: state.errorCode });
        return;
      }

      if (state.step === "authenticated") {
        authenticatedAt.current = Date.now();
        setNotice(null);
        return;
      }

      // Back to a settled, signed-out state. If that happened moments after a
      // successful login it was the SDK clearing the session, not the user.
      if (state.step === "idle") {
        const grantedAt = authenticatedAt.current;
        authenticatedAt.current = null;
        setNotice(
          grantedAt !== null && Date.now() - grantedAt < DROPPED_WINDOW_MS
            ? { kind: "dropped" }
            : null
        );
      }
    });
  }, [getClient]);

  if (!notice) return null;

  return (
    <div role="alert" className="mx-auto w-full max-w-2xl px-4 pt-4">
      <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm leading-6 text-error">
        {notice.kind === "error" ? (
          <>
            No se pudo completar el ingreso: {notice.message}{" "}
            <span className="font-mono text-xs opacity-75">({notice.code})</span>
          </>
        ) : (
          <>
            Entraste y la sesión se cerró sola enseguida. Pollar rechazó el
            primer pedido con la sesión recién creada. Probá de nuevo con una
            sola pestaña abierta; si se repite, revisá los TTL de token en el
            dashboard de Pollar.
          </>
        )}
      </p>
    </div>
  );
}
