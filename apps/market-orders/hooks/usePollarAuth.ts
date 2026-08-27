"use client";

import { useEffect, useMemo, useState } from "react";
import { usePollar } from "@pollar/react";
import type { AuthState, PollarUserProfile, WalletInfo } from "@pollar/core";

export interface PollarUser {
  address: string;
  profile: PollarUserProfile | null;
  wallet: WalletInfo;
}

const SETTLED_STEPS: AuthState["step"][] = [
  "idle",
  "authenticated",
  "error",
  "entering_email",
  "entering_code",
  "wallet_not_installed",
];

export function usePollarAuth(): {
  user: PollarUser | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  verified: boolean;
  accessToken: string | null;
} {
  const { isAuthenticated, verified, logout, openLoginModal, getClient } =
    usePollar();
  const client = getClient();

  const [authStep, setAuthStep] = useState<AuthState["step"]>("idle");

  useEffect(() => {
    return client.onAuthStateChange((state) => setAuthStep(state.step));
  }, [client]);

  const address = client.getWallet()?.address ?? null;

  const user = useMemo<PollarUser | null>(() => {
    if (!isAuthenticated || !address) return null;
    const w = client.getWallet();
    if (!w) return null;
    return {
      address,
      profile: client.getUserProfile(),
      wallet: w,
    };
  }, [isAuthenticated, address, client]);

  const accessToken = useMemo(() => {
    if (authStep !== "authenticated") return null;
    const state = client.getAuthState();
    if (state.step !== "authenticated") return null;
    return state.session.token.accessToken;
  }, [authStep, client]);

  return {
    user,
    isLoading: !SETTLED_STEPS.includes(authStep),
    login: openLoginModal,
    logout,
    verified,
    accessToken,
  };
}