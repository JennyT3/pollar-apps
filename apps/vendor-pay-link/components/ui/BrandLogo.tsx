"use client";

import Image from "next/image";

/** Logo oficial (`public/logo-pollar.webp`). */
export function BrandLogo({
  size = 32,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-pollar.webp"
        alt="Pollar"
        fill
        sizes={`${size}px`}
        priority={priority}
        className="object-contain"
      />
    </span>
  );
}
