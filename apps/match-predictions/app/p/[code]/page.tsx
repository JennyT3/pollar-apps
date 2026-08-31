import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PollaScreen } from "@/components/polla/PollaScreen";
import { findPolla, loadPolla } from "@/lib/queries";
import { currentAddress } from "@/lib/session";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const polla = await findPolla(code);
  return {
    title: polla ? `${polla.name} · La Polla` : "La Polla",
    description: polla
      ? `Tabla, pozo y pronósticos de ${polla.name}.`
      : undefined,
  };
}

/**
 * Rendered on the server so the standings are on screen in the first paint,
 * with the viewer's session already read from the cookie. From there the client
 * takes over and keeps it live.
 */
export default async function PollaPage({ params }: Props) {
  const { code } = await params;
  const polla = await findPolla(code);
  if (!polla) notFound();

  const view = await loadPolla(polla, await currentAddress());

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        <PollaScreen initial={view} />
      </main>
    </>
  );
}
