"use client";

import { useState } from "react";
import { AccountModal } from "@/components/AccountModal";
import { Button } from "@/components/ui/Button";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useLanguage } from "@/lib/i18n";

/**
 * Logged out: the "Log in with Pollar" button. Logged in: a round account
 * button that opens the account modal (email, wallet address, log out).
 */
export function LoginButton() {
  const { user, isLoading, login } = usePollarAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const { t } = useLanguage();

  if (user) {
    const initial = (user.profile?.mail?.[0] ?? "P").toUpperCase();
    return (
      <>
        <button
          onClick={() => setAccountOpen(true)}
          aria-label={t("login.accountLabel")}
          title={user.profile?.mail ?? user.address}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-primary transition-colors hover:bg-surface-hover"
        >
          {initial}
        </button>
        <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      </>
    );
  }

  return (
    <Button onClick={login} loading={isLoading}>
      {isLoading ? t("login.connecting") : t("login.button")}
    </Button>
  );
}
