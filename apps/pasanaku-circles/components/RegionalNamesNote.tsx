"use client";

import { CANONICAL_NAME, REGIONAL_NAMES } from "@/lib/regional-names";

export function RegionalNamesNote({ className = "" }: { className?: string }) {
  return (
    <details className={`text-left text-sm text-muted ${className}`}>
      <summary className="cursor-pointer text-muted">
        En Bolivia es {CANONICAL_NAME}. En México tanda. En Perú pandero.
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {REGIONAL_NAMES.map((row) => (
          <li key={row.country}>
            <span className="font-medium text-foreground">{row.country}:</span>{" "}
            {row.names.join(" · ")}
          </li>
        ))}
      </ul>
    </details>
  );
}
