const CYAN = "hsl(185 85% 70%)";

export function PipelineIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 200 200"
            className={className}
        >
            {/* Pipeline flow - left to right with processing nodes */}

            {/* Input node (circle) */}
            <circle
                cx="30"
                cy="100"
                r="15"
                fill="none"
                stroke={CYAN}
                strokeWidth="3"
            />
            <circle
                cx="30"
                cy="100"
                r="8"
                fill={CYAN}
                opacity="0.6"
            />

            {/* Pipeline from input to processor */}
            <line
                x1="45"
                y1="100"
                x2="70"
                y2="100"
                stroke={CYAN}
                strokeWidth="3"
            />

            {/* Arrow 1 */}
            <polygon
                points="70,100 65,95 65,105"
                fill={CYAN}
            />

            {/* Processor node (hexagon) */}
            <polygon
                points="85,85 115,85 125,100 115,115 85,115 75,100"
                fill="none"
                stroke={CYAN}
                strokeWidth="3"
            />
            <circle
                cx="100"
                cy="100"
                r="5"
                fill={CYAN}
                opacity="0.8"
            />

            {/* Pipeline from processor to output */}
            <line
                x1="125"
                y1="100"
                x2="150"
                y2="100"
                stroke={CYAN}
                strokeWidth="3"
            />

            {/* Arrow 2 */}
            <polygon
                points="150,100 145,95 145,105"
                fill={CYAN}
            />

            {/* Output node (square) */}
            <rect
                x="155"
                y="85"
                width="30"
                height="30"
                fill="none"
                stroke={CYAN}
                strokeWidth="3"
            />
            <rect
                x="162"
                y="92"
                width="16"
                height="16"
                fill={CYAN}
                opacity="0.6"
            />
        </svg>
    );
}
