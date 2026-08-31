import Image from "next/image";
import { PollarLogo } from "@/components/ui/PollarLogo";

/**
 * This demo pays a Nirium endpoint through a Pollar-issued signer — it's
 * Nirium's integration, built to show off nirium-pollar-adapter, not a
 * Pollar-native app. Without both marks here, a reviewer with no prior
 * context sees only the Pollar bear and has no visual cue Nirium exists.
 */
export function BrandHeader({ size = 30 }: { size?: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Image
        src="/nirium-logo.png"
        alt="Nirium"
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
      <span
        aria-hidden="true"
        className="text-sm font-medium text-muted-light"
        style={{ fontSize: Math.max(11, size * 0.4) }}
      >
        ×
      </span>
      <PollarLogo size={size} />
    </div>
  );
}
