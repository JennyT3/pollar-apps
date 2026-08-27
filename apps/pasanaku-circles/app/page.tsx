"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { BalanceCard } from "@/components/BalanceCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoginButton } from "@/components/LoginButton";
import { RegionalNamesNote } from "@/components/RegionalNamesNote";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { usePollarAuth } from "@/hooks/usePollarAuth";

type CircleRow = {
  code: string;
  name: string;
  amount: string;
  currentRound: number;
  status?: string;
};

export default function Home() {
  const { user } = usePollarAuth();
  const [circles, setCircles] = useState<CircleRow[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/circles?address=${user.address}`)
      .then((res) => res.json())
      .then((body) => setCircles(body.circles ?? []))
      .catch(() => setCircles([]));
  }, [user]);

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <PollarLogo size={104} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Pasanaku digital
            <span className="block text-primary">rondas con QR</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            Un círculo, un monto fijo, un turno cada ronda. Pagás escaneando,
            como en la tienda.
          </p>
          <RegionalNamesNote className="max-w-sm" />
        </div>
        <LoginButton />
      </main>
    );
  }

  return (
    <AppShell>
      <BalanceCard />
      <Link href="/c/new">
        <Button className="w-full">Crear círculo</Button>
      </Link>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">Tus círculos</h2>
        {circles.length === 0 ? (
          <p className="text-sm text-muted">Todavía no estás en ningún círculo.</p>
        ) : (
          circles.map((circle) => (
            <Link key={circle.code} href={`/c/${circle.code}`}>
              <Card className="p-4">
                <p className="font-semibold">{circle.name}</p>
                <p className="text-sm text-muted">
                  {circle.amount} USDC ·{" "}
                  {circle.status === "completed"
                    ? "cerrado"
                    : `ronda ${circle.currentRound}`}
                </p>
              </Card>
            </Link>
          ))
        )}
      </section>
    </AppShell>
  );
}
