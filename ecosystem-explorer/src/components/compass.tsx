import { useEffect, useState } from "react";

const CYAN = "hsl(185 85% 70%)";

export function Compass({ className }: { className?: string }) {
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setRotation((prev) => (prev + 0.5) % 360);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={className}>
            <svg
                viewBox="0 0 200 200"
                className="w-full h-full"
                style={{ filter: "drop-shadow(0 0 25px rgba(109, 216, 229, 0.9)) drop-shadow(0 0 50px rgba(109," +
                        " 216, 229, 0.6)) drop-shadow(0 0 80px rgba(109, 216, 229, 0.4))" }}
            >
                {/* Outer ring */}
                <circle
                    cx="100"
                    cy="100"
                    r="95"
                    fill="none"
                    stroke={CYAN}
                    strokeWidth="1.5"
                    opacity="0.4"
                />
                <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke={CYAN}
                    strokeWidth="0.5"
                    opacity="0.2"
                />

                {/* Degree markings */}
                {Array.from({ length: 72 }).map((_, i) => {
                    const angle = (i * 5 * Math.PI) / 180;
                    const isMajor = i % 6 === 0;
                    const innerR = isMajor ? 80 : 85;
                    const outerR = 90;
                    return (
                        <line
                            key={i}
                            x1={100 + innerR * Math.sin(angle)}
                            y1={100 - innerR * Math.cos(angle)}
                            x2={100 + outerR * Math.sin(angle)}
                            y2={100 - outerR * Math.cos(angle)}
                            stroke={CYAN}
                            strokeWidth={isMajor ? 1.5 : 0.5}
                            opacity={isMajor ? 0.7 : 0.3}
                        />
                    );
                })}

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
                            className="font-mono text-sm font-bold"
                            style={{ filter: "drop-shadow(0 0 4px rgba(109, 216, 229, 0.8))" }}
                        >
                            {dir}
                        </text>
                    );
                })}

                {/* Rotating needle group */}
                <g
                    style={{
                        transform: `rotate(${rotation}deg)`,
                        transformOrigin: "100px 100px",
                        transition: "transform 0.05s linear",
                    }}
                >
                    {/* North needle */}
                    <polygon
                        points="100,25 95,100 100,90 105,100"
                        fill={CYAN}
                        style={{ filter: "drop-shadow(0 0 6px rgba(109, 216, 229, 0.9))" }}
                    />
                    {/* South needle */}
                    <polygon
                        points="100,175 95,100 100,110 105,100"
                        fill={CYAN}
                        opacity="0.4"
                    />
                </g>

                {/* Center circle */}
                <circle cx="100" cy="100" r="8" className="fill-secondary" opacity="0.6" />
                <circle
                    cx="100"
                    cy="100"
                    r="4"
                    fill={CYAN}
                    style={{ filter: "drop-shadow(0 0 10px rgba(109, 216, 229, 1)) drop-shadow(0 0 20px rgba(109, 216, 229, 0.8))" }}
                />

                {/* Inner decorative circles */}
                <circle
                    cx="100"
                    cy="100"
                    r="50"
                    fill="none"
                    stroke={CYAN}
                    strokeWidth="0.5"
                    opacity="0.2"
                    strokeDasharray="4 4"
                />
            </svg>
        </div>
    );
}
