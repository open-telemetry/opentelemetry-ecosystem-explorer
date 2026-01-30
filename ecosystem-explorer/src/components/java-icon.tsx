const CYAN = "hsl(185 85% 70%)";

export function JavaIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            className={className}
        >
            {/* Coffee cup */}
            <path
                d="M 60 80 L 50 160 Q 50 170 60 170 L 140 170 Q 150 170 150 160 L 140 80 Z"
                fill="none"
                stroke={CYAN}
                strokeWidth="4"
            />

            {/* Coffee fill */}
            <path
                d="M 65 90 L 57 155 Q 57 162 63 162 L 137 162 Q 143 162 143 155 L 135 90 Z"
                fill={CYAN}
                opacity="0.3"
            />

            {/* Cup handle */}
            <path
                d="M 150 100 Q 170 100 170 120 Q 170 140 150 140"
                fill="none"
                stroke={CYAN}
                strokeWidth="4"
            />

            {/* Steam lines - curved upward */}
            <path
                d="M 70 70 Q 65 50 70 30"
                fill="none"
                stroke={CYAN}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
            />
            <path
                d="M 100 75 Q 95 55 100 35"
                fill="none"
                stroke={CYAN}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
            />
            <path
                d="M 130 70 Q 125 50 130 30"
                fill="none"
                stroke={CYAN}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
            />
        </svg>
    );
}
