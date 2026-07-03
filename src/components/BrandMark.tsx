/**
 * SurdaCatalog placeholder branding — replaces the old generic checkmark mark.
 * Uses the app palette (primary square, accent dot, white monogram). Not a
 * final logo; a consistent stand-in until real artwork is delivered.
 */

export function BrandMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="SurdaCatalog"
      className={className}
    >
      <rect width="48" height="48" rx="12" fill="hsl(var(--primary))" />
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontFamily="Tajawal, sans-serif"
        fontWeight="800"
        fontSize="26"
        fill="hsl(var(--primary-foreground))"
      >
        S
      </text>
      <circle cx="36" cy="13" r="4" fill="hsl(var(--accent))" />
    </svg>
  );
}

export function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <span dir="ltr" className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-primary">Surda</span>
      <span className="text-accent">Catalog</span>
    </span>
  );
}
