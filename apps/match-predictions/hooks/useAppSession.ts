"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePollar } from "@pollar/react";
import { api } from "@/lib/api";
import { usePollarAuth } from "@/hooks/usePollarAuth";

/**
 * Proving to this app's server which Pollar account is asking.
 *
 * Pollar signs the user in on the client, but nothing in that session can be
 * checked by a server, so an address in a request body proves nothing. Here the
 * account signs a short message under SEP-53 and the server verifies the
 * signature against the address (see lib/session.ts). That signature is what
 * authorises entering results or editing a prediction, not a claim in a form.
 *
 * It is asked for lazily, right before the first write, so browsing a polla
 * never interrupts anyone with a signature prompt. On the custodial wallets
 * most players have, signing is a round trip with nothing to confirm.
 *
 * It also waits for `verified`. A session restored from storage, or one seconds
 * old, is optimistic until the SDK revalidates it with the server, and firing an
 * authenticated request at it before then earns a 401 mid-refresh. The
 * template's own `useBalance` gates on the same flag for the same reason.
 */
export function useAppSession(): {
  /** The address this browser has proved, or null. */
  address: string | null;
  /** True once the proved address is the logged-in Pollar account. */
  ready: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** Proves the account if needed and returns the address. Throws on failure. */
  ensure: () => Promise<string>;
} {
  const { user, verified } = usePollarAuth();
  const { getClient } = usePollar();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One sign-in at a time: two writes firing together would burn two nonces
  // and race two cookie writes.
  const inflight = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ address: string | null }>("/api/auth/session")
      .then((res) => {
        if (!cancelled) setAddress(res.address);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensure = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Iniciá sesión con Pollar primero.");
    if (address === user.address) return address;
    if (!verified) {
      throw new Error(
        "Tu sesión se está confirmando. Esperá un segundo y volvé a intentar."
      );
    }
    if (inflight.current) return inflight.current;

    const run = (async () => {
      setBusy(true);
      setError(null);
      try {
        const challenge = await api<{ nonce: string; message: string }>(
          "/api/auth/challenge",
          { method: "POST", json: { address: user.address } }
        );

        const proof = await getClient().stellar.sep53.signMessage(challenge.message);
        if (proof.status !== "signed") {
          throw new Error(
            proof.details ??
              "Tu billetera no pudo firmar el mensaje de verificación."
          );
        }

        const session = await api<{ address: string }>("/api/auth/session", {
          method: "POST",
          json: {
            address: proof.signerAddress,
            nonce: challenge.nonce,
            signature: proof.signature,
          },
        });
        setAddress(session.address);
        return session.address;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No pudimos verificar tu cuenta.";
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
        inflight.current = null;
      }
    })();

    inflight.current = run;
    return run;
  }, [address, getClient, user, verified]);

  // Logging out of Pollar, or switching accounts, drops the proof with it.
  useEffect(() => {
    if (user || !address) return;
    let cancelled = false;
    void api("/api/auth/session", { method: "DELETE" })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, address]);

  return {
    address,
    ready: Boolean(user && address === user.address),
    loading,
    busy,
    error,
    ensure,
  };
}
