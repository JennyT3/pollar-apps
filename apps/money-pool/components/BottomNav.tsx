"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePollarAuth } from "@/hooks/usePollarAuth";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = usePollarAuth();

  if (!user) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-surface border-t border-border z-50">
      <div className="mx-auto flex max-w-md items-center justify-around h-16 px-4">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            pathname === "/" ? "text-primary font-semibold" : "text-muted hover:text-foreground"
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={pathname === "/" ? "2.5" : "2"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="text-[10px]">Inicio</span>
        </Link>
        <Link
          href="/pool/new"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            pathname === "/pool/new" ? "text-primary font-semibold" : "text-muted hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-sm">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="text-[10px]">Crear Pool</span>
        </Link>
        <Link
          href="/history"
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
            pathname === "/history" ? "text-primary font-semibold" : "text-muted hover:text-foreground"
          }`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={pathname === "/history" ? "2.5" : "2"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span className="text-[10px]">Historial</span>
        </Link>
      </div>
    </div>
  );
}
