import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { JoinScreen } from "@/components/polla/JoinScreen";
import { findPolla, loadPolla } from "@/lib/queries";
import { currentAddress } from "@/lib/session";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const polla = await findPolla(code);
  return {
    title: polla ? `Entrar a ${polla.name} · La Polla` : "La Polla",
  };
}

/** The QR target: everything the player needs to pay, already filled in. */
export default async function UnirsePage({ params }: Props) {
  const { code } = await params;
  const polla = await findPolla(code);
  if (!polla) notFound();

  const view = await loadPolla(polla, await currentAddress());

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <JoinScreen initial={view} />
      </main>
    </>
  );
}
