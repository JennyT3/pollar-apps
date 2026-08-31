"use client";

import { useLanguage } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, toggle } = useLanguage();

  return (
    <button
      onClick={toggle}
      aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}
      title={lang === "en" ? "Cambiar a español" : "Switch to English"}
      className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface px-2.5 text-xs font-bold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {lang === "en" ? "ES" : "EN"}
    </button>
  );
}
