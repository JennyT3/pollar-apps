"use client";

import { useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import type { AuthState } from "@pollar/core";

/**
 * Says out loud when a login failed.
 *
 * The SDK finishes an OAuth login by polling its own API for the popup's
 * session to turn ready, and if that never happens it lands on `AuthState.step
 * === 'error'` with a message. Nothing renders that by default, so the popup
 * says "account authenticated", the window closes, and the app is still sitting
 * on the logged-out button with no explanation. A player hitting that has no way
 * to tell a timeout from an unregistered domain from their own bad connection.
 *
 * So the state is surfaced where the login happens, error code included: it is
 * the difference between "this is broken" and "add this origin under Build →
 * Domains".
 */
export function AuthNotice() {
  const { getClient } = usePollar();
  const [error, setError] = useState<{ message: string; code: string } | null>(
    null
  );

  useEffect(() => {
    // Fires immediately with the current state, then on every change, and
    // returns its own unsubscribe.
    return getClient().onAuthStateChange((state: AuthState) => {
      setError(
        state.step === "error"
          ? { message: state.message, code: state.errorCode }
          : null
      );
    });
  }, [getClient]);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-2xl px-4 pt-4"
    >
      <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
        No se pudo completar el ingreso: {error.message}{" "}
        <span className="font-mono text-xs opacity-75">({error.code})</span>
      </p>
    </div>
  );
}
