"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CaseraIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/casera/menu");
  }, [router]);
  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </main>
  );
}