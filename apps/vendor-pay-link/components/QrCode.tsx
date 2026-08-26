"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrCode({
  value,
  size = 220,
  title,
  className = "",
}: {
  value: string;
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full rounded-2xl bg-background p-3 sm:p-4 ${className}`}
      style={{ maxWidth: size }}
      title={title}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={2}
        bgColor="var(--background)"
        fgColor="var(--foreground)"
        className="h-auto w-full"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}
