"use client";

import { useState, useEffect } from "react";
import { formatPoolAmount, middleTruncate } from "@/lib/format";
import { STELLAR_EXPERT_URL } from "@/lib/stellar";
import { EmptyState } from "./ui/EmptyState";

interface Contribution {
  id: string;
  contributorName: string | null;
  contributorAddress?: string | null;
  amount: string;
  txHash: string;
  createdAt: string;
}

interface ContributionListProps {
  contributions: Contribution[];
  currency?: string;
}

export function ContributionList({ contributions, currency = "USDC" }: ContributionListProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const start = () => {
      setNow(Date.now());
      timeout = setInterval(() => setNow(Date.now()), 60000);
    };
    const initialTimeout = setTimeout(start, 0);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timeout);
    };
  }, []);

  if (contributions.length === 0) {
    return (
      <div className="mt-6 border border-dashed border-border rounded-xl">
        <EmptyState title="Aún no hay contribuciones." description="¡Sé el primero!" />
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Historial</h3>
      <div className="space-y-3">
        {contributions.map((c) => {
          const explorerUrl = `${STELLAR_EXPERT_URL}/tx/${c.txHash}`;
          const isAnonymous = !c.contributorName && !c.contributorAddress;

          let displayName = "Anónimo";
          if (c.contributorName) {
            displayName = c.contributorName;
          } else if (c.contributorAddress) {
            displayName = `${c.contributorAddress.slice(0, 4)}...${c.contributorAddress.slice(-4)}`;
          }

          const date = new Date(c.createdAt);

          let relativeTime = "";
          if (now === null) {
            relativeTime = "";
          } else {
            const diffInSeconds = Math.floor((now - date.getTime()) / 1000);
            if (diffInSeconds < 60) relativeTime = "hace un momento";
            else if (diffInSeconds < 3600) relativeTime = `hace ${Math.floor(diffInSeconds / 60)} min`;
            else if (diffInSeconds < 86400) relativeTime = `hace ${Math.floor(diffInSeconds / 3600)} h`;
            else relativeTime = date.toLocaleDateString();
          }

          return (
            <div key={c.id} className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold">
                  {isAnonymous ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  ) : displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted">
                    {relativeTime} •{" "}
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors hover:underline"
                      title="Ver transacción en StellarExpert"
                    >
                      {middleTruncate(c.txHash, 8, 8)}
                    </a>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">+${formatPoolAmount(c.amount)}</p>
                <p className="text-xs text-muted">{currency}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
