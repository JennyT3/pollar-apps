import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { PollarLogo } from "@/components/ui/PollarLogo";

/** Same bar on every screen: home, the app's name, and the Pollar account. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <PollarLogo size={26} />
          <span>La Polla</span>
        </Link>
        <LoginButton />
      </div>
    </header>
  );
}
