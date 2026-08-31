import Link from "next/link";

/** Round back-chevron button, same style as Modal's back button, for page-level nav. */
export function BackLink({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Back"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
