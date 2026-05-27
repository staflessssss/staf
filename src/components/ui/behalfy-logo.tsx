import { cn } from "@/lib/utils";

type BehalfyLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showText?: boolean;
};

export function BehalfyLogo({
  className,
  markClassName,
  textClassName,
  showText = true,
}: BehalfyLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 118 78"
        aria-hidden="true"
        className={cn("h-10 w-[61px] shrink-0", markClassName)}
      >
        <defs>
          <linearGradient id="behalfy-mark-shell" x1="5" x2="113" y1="39" y2="39" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e5dcff" />
            <stop offset="1" stopColor="#7435ef" />
          </linearGradient>
          <linearGradient id="behalfy-mark-letter" x1="42" x2="104" y1="39" y2="39" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a16bff" />
            <stop offset="1" stopColor="#7435ef" />
          </linearGradient>
        </defs>
        <rect x="5" y="4" width="108" height="70" rx="20" fill="url(#behalfy-mark-shell)" />
        <text
          x="36"
          y="64"
          fill="#b18aff"
          opacity="0.58"
          fontFamily="Arial Black, Arial, sans-serif"
          fontSize="74"
          fontWeight="900"
          letterSpacing="-8"
        >
          B
        </text>
        <text
          x="51"
          y="64"
          fill="url(#behalfy-mark-letter)"
          fontFamily="Arial Black, Arial, sans-serif"
          fontSize="74"
          fontWeight="900"
          letterSpacing="-8"
        >
          B
        </text>
      </svg>
      {showText ? (
        <span
          className={cn(
            "font-heading text-[2rem] font-black leading-none tracking-[-0.045em] text-[#7c3ff2]",
            textClassName,
          )}
        >
          behalfy
        </span>
      ) : null}
    </div>
  );
}
