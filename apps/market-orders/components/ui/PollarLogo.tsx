export function PollarLogo({
  size = 28,
  colorClass = "bg-logo",
  className = "",
}: {
  size?: number;
  colorClass?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${colorClass} ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: "url(/pollar-logo-light.svg)",
        WebkitMaskImage: "url(/pollar-logo-light.svg)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
