export function JavaInstrumentationIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-label="Instrumentation Icon with Interconnected Nodes"
      role="img"
      className={className}
    >
      {/* Central hub node */}
      <circle cx="100" cy="100" r="20" fill="hsl(var(--color-primary))" opacity="0.2" />
      <circle
        cx="100"
        cy="100"
        r="20"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="100" cy="100" r="8" fill="hsl(var(--color-primary))" opacity="0.8" />

      {/* Top node */}
      <circle
        cx="100"
        cy="40"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="100" cy="40" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="100"
        y1="55"
        x2="100"
        y2="80"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Top-right node */}
      <circle
        cx="152"
        cy="65"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="152" cy="65" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="142"
        y1="75"
        x2="115"
        y2="92"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Right node */}
      <circle
        cx="160"
        cy="100"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="160" cy="100" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="145"
        y1="100"
        x2="120"
        y2="100"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Bottom-right node */}
      <circle
        cx="152"
        cy="135"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="152" cy="135" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="142"
        y1="125"
        x2="115"
        y2="108"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Bottom node */}
      <circle
        cx="100"
        cy="160"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="100" cy="160" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="100"
        y1="145"
        x2="100"
        y2="120"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Bottom-left node */}
      <circle
        cx="48"
        cy="135"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="48" cy="135" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="58"
        y1="125"
        x2="85"
        y2="108"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Left node */}
      <circle
        cx="40"
        cy="100"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="40" cy="100" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="55"
        y1="100"
        x2="80"
        y2="100"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />

      {/* Top-left node */}
      <circle
        cx="48"
        cy="65"
        r="15"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />
      <circle cx="48" cy="65" r="6" fill="hsl(var(--color-primary))" opacity="0.6" />
      <line
        x1="58"
        y1="75"
        x2="85"
        y2="92"
        stroke="hsl(var(--color-primary))"
        strokeWidth="2.5"
        strokeDasharray="4 3"
      />
    </svg>
  );
}
