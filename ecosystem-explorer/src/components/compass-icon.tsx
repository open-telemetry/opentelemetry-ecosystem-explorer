const CYAN = "hsl(185 85% 70%)";

export function CompassIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            className={className}
            style={{ filter: "drop-shadow(0 0 8px rgba(109, 216, 229, 0.5))" }}
        >
            {/* Outer ring */}
            <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke={CYAN}
                strokeWidth="3"
                opacity="0.6"
            />

            {/* Cardinal directions */}
            {["N", "E", "S", "W"].map((dir, i) => {
                const angle = (i * 90 * Math.PI) / 180;
                const r = 70;
                return (
                    <text
                        key={dir}
                        x={100 + r * Math.sin(angle)}
                        y={100 - r * Math.cos(angle)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={CYAN}
                        className="font-mono text-2xl font-bold"
                        opacity="0.8"
                    >
                        {dir}
                    </text>
                );
            })}

            {/* Needle pointing north */}
            <polygon
                points="100,30 95,100 100,95 105,100"
                fill={CYAN}
                opacity="0.9"
            />

            {/* Center circle */}
            <circle cx="100" cy="100" r="8" fill="currentColor" opacity="0.4" />
            <circle
                cx="100"
                cy="100"
                r="5"
                fill={CYAN}
            />
        </svg>
    );
}
