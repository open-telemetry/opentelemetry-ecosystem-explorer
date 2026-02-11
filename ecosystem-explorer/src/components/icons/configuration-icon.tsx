export function ConfigurationIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-label="Configuration Icon with Settings Panel"
      role="img"
      className={className}
    >
      {/* Panel background */}
      <rect
        x="40"
        y="40"
        width="120"
        height="120"
        rx="8"
        fill="hsl(var(--color-primary))"
        opacity="0.08"
      />
      <rect
        x="40"
        y="40"
        width="120"
        height="120"
        rx="8"
        fill="none"
        stroke="hsl(var(--color-primary))"
        strokeWidth="3"
      />

      {/* Slider 1 - Top */}
      <g>
        {/* Track */}
        <line
          x1="65"
          y1="70"
          x2="135"
          y2="70"
          stroke="hsl(var(--color-primary))"
          strokeWidth="3"
          opacity="0.3"
        />
        {/* Active portion */}
        <line
          x1="65"
          y1="70"
          x2="95"
          y2="70"
          stroke="hsl(var(--color-primary))"
          strokeWidth="3"
          opacity="0.8"
        />
        {/* Knob */}
        <circle cx="95" cy="70" r="8" fill="hsl(var(--color-primary))" />
        <circle cx="95" cy="70" r="5" fill="white" opacity="0.3" />
      </g>

      {/* Slider 2 - Middle-top */}
      <g>
        <line
          x1="65"
          y1="100"
          x2="135"
          y2="100"
          stroke="hsl(var(--color-primary))"
          strokeWidth="3"
          opacity="0.3"
        />
        <line
          x1="65"
          y1="100"
          x2="120"
          y2="100"
          stroke="hsl(var(--color-primary))"
          strokeWidth="3"
          opacity="0.8"
        />
        <circle cx="120" cy="100" r="8" fill="hsl(var(--color-primary))" />
        <circle cx="120" cy="100" r="5" fill="white" opacity="0.3" />
      </g>

      {/* Slider 3 - Middle-bottom */}
      <g>
        <line
          x1="65"
          y1="130"
          x2="135"
          y2="130"
          stroke="hsl(var(--color-primary))"
          strokeWidth="3"
          opacity="0.3"
        />
        <line
          x1="65"
          y1="130"
          x2="80"
          y2="130"
          stroke="hsl(var(--color-primary))"
          strokeWidth="3"
          opacity="0.8"
        />
        <circle cx="80" cy="130" r="8" fill="hsl(var(--color-primary))" />
        <circle cx="80" cy="130" r="5" fill="white" opacity="0.3" />
      </g>

      {/* Gear icon accent in top-right */}
      <g transform="translate(145, 55)">
        <circle
          cx="0"
          cy="0"
          r="10"
          fill="none"
          stroke="hsl(var(--color-primary))"
          strokeWidth="2"
        />
        <circle cx="0" cy="0" r="4" fill="hsl(var(--color-primary))" opacity="0.6" />
        {/* Gear teeth */}
        <rect x="-2" y="-12" width="4" height="4" fill="hsl(var(--color-primary))" />
        <rect x="-2" y="8" width="4" height="4" fill="hsl(var(--color-primary))" />
        <rect x="-12" y="-2" width="4" height="4" fill="hsl(var(--color-primary))" />
        <rect x="8" y="-2" width="4" height="4" fill="hsl(var(--color-primary))" />
      </g>
    </svg>
  );
}
