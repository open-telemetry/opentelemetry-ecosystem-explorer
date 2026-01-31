export function JavaIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 200 200" className={className}>
            {/* Coffee cup outline */}
            <path
                d="M 60 80 L 50 160 Q 50 170 60 170 L 140 170 Q 150 170 150 160 L 140 80 Z"
                fill="none"
                stroke="hsl(var(--color-primary))"
                strokeWidth="4"
            />

            {/* Define the "inside cup" region as a clipPath */}
            <defs>
                <clipPath id="cup-fill-clip">
                    <path d="M 65 90 L 57 155 Q 57 162 63 162 L 137 162 Q 143 162 143 155 L 135 90 Z" />
                </clipPath>
            </defs>

            {/* faint liquid tint behind the bars */}
            <path
                d="M 65 90 L 57 155 Q 57 162 63 162 L 137 162 Q 143 162 143 155 L 135 90 Z"
                fill="hsl(var(--color-primary))"
                opacity="0.10"
            />

            {/* Metric bar chart inside the cup */}
            <g clipPath="url(#cup-fill-clip)">
                {/* Baseline */}
                <line
                    x1="62"
                    y1="158"
                    x2="138"
                    y2="158"
                    stroke="hsl(var(--color-primary))"
                    strokeWidth="2"
                    opacity="0.25"
                />

                {/* Bars */}
                {/*
                  Coordinates notes:
                  - cup interior is roughly x: 60..140 and y: 90..162
                  - y grows downward, so taller bars have smaller y (higher up)
                */}
                <rect x="68" y="132" width="10" height="26" fill="hsl(var(--color-primary))" opacity="0.35" rx="2" />
                <rect x="83" y="120" width="10" height="38" fill="hsl(var(--color-primary))" opacity="0.45" rx="2" />
                <rect x="98" y="140" width="10" height="18" fill="hsl(var(--color-primary))" opacity="0.30" rx="2" />
                <rect x="113" y="112" width="10" height="46" fill="hsl(var(--color-primary))" opacity="0.55" rx="2" />
                <rect x="128" y="126" width="10" height="32" fill="hsl(var(--color-primary))" opacity="0.40" rx="2" />

                {/* Subtle highlight band near the top, to keep "liquid" feel */}
                <rect x="58" y="95" width="90" height="10" fill="white" opacity="0.10" />
            </g>

            {/* Cup handle */}
            <path
                d="M 150 100 Q 170 100 170 120 Q 170 140 150 140"
                fill="none"
                stroke="hsl(var(--color-primary))"
                strokeWidth="4"
            />

            {/* Steam lines */}
            <path
                d="M 70 70 Q 65 50 70 30"
                fill="none"
                stroke="hsl(var(--color-primary))"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
            />
            <path
                d="M 100 75 Q 95 55 100 35"
                fill="none"
                stroke="hsl(var(--color-primary))"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
            />
            <path
                d="M 130 70 Q 125 50 130 30"
                fill="none"
                stroke="hsl(var(--color-primary))"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
            />
        </svg>
    );
}