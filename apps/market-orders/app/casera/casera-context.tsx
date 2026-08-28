"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePollarAuth } from "@/hooks/usePollarAuth";

const ADMIN_TOKEN_KEY = "ct_admin_token";

function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldOut: boolean;
}

export interface Stall {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Casera {
  stall: Stall | null;
  /** Admin token for this device, or null if the key was never saved here. */
  adminToken: string | null;
  /** True while the stall is being loaded for the first time. */
  loading: boolean;
  hasToken: boolean;
  reload: () => Promise<void>;
  setAdminToken: (token: string | null) => void;
}

const CaseraContext = createContext<Casera | null>(null);

export function useCasera(): Casera {
  const ctx = useContext(CaseraContext);
  if (!ctx) throw new Error("useCasera must be used inside CaseraProvider");
  return ctx;
}

async function loadStall(address: string): Promise<Stall | null> {
  const res = await fetch(`/api/stall?address=${address}`);
  if (res.ok) return await res.json();
  return null;
}

/**
 * Loads the logged-in casera's stall once and shares it (plus the localStorage
 * admin token) with every casera screen under /casera. Mutating screens call
 * `reload()` after a change so the shared stall stays fresh.
 */
export function CaseraProvider({ children }: { children: ReactNode }) {
  const { user } = usePollarAuth();
  const [stall, setStall] = useState<Stall | null>(null);
  const [adminToken, setAdminTokenState] = useState<string | null>(() =>
    readAdminToken()
  );
  const [loading, setLoading] = useState(true);

  // Handlers call this after a mutation; setState is fine there.
  const reload = useCallback(async () => {
    if (!user) return;
    try {
      setStall(await loadStall(user.address));
    } catch {
      setStall(null);
    }
    setLoading(false);
  }, [user]);

  // Initial load: await before touching state (React 19 lint rule).
  useEffect(() => {
    if (!user) return;
    const address = user.address;
    let cancelled = false;
    async function load() {
      try {
        const s = await loadStall(address);
        if (!cancelled) setStall(s);
      } catch {
        if (!cancelled) setStall(null);
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setAdminToken = useCallback((token: string | null) => {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    setAdminTokenState(token);
  }, []);

  return (
    <CaseraContext.Provider
      value={{
        stall,
        adminToken,
        loading,
        hasToken: Boolean(adminToken),
        reload,
        setAdminToken,
      }}
    >
      {children}
    </CaseraContext.Provider>
  );
}