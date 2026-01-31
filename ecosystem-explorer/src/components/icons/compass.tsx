import { useEffect, useRef, useState } from "react";

/** Animated Compass SVG Component, hidden when not visible in viewport. */
export function Compass({ className }: { className?: string }) {
  const needleGroupRef = useRef<SVGGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const currentRotationRef = useRef(0);

  // Handle page visibility changes (e.g., tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Handle intersection observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Animation loop - only runs when visible
  useEffect(() => {
    if (!isVisible || !isPageVisible) return;

    let rafId = 0;
    const degreesPerSecond = 5;
    // Adjust start time based on current rotation to ensure smooth resume
    const start = performance.now() - (currentRotationRef.current / degreesPerSecond) * 1000;

    const tick = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      const rotation = (elapsedSec * degreesPerSecond) % 360;

      // Store current rotation for smooth resume after visibility changes
      currentRotationRef.current = rotation;

      const g = needleGroupRef.current;
      if (g) {
        g.setAttribute("transform", `rotate(${rotation} 100 100)`);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, isPageVisible]);

  return (
    <div ref={containerRef} className={className}>
      <svg
        viewBox="0 0 200 200"
        aria-label="Animated Compass"
        role="img"
        className="w-full h-full"
        style={{
          filter:
            "drop-shadow(0 0 8px hsl(var(--color-primary) / 0.4)) drop-shadow(0 0 16px hsl(var(--color-primary) / 0.2))",
        }}
      >
        {/* Outer ring */}
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke="hsl(var(--color-primary))"
          strokeWidth="1.5"
          opacity="0.4"
        />
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="hsl(var(--color-primary))"
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
              stroke="hsl(var(--color-primary))"
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
              fill="hsl(var(--color-primary))"
              className="font-mono text-sm font-bold"
            >
              {dir}
            </text>
          );
        })}

        {/* Rotating needle group */}
        <g ref={needleGroupRef}>
          {/* North needle */}
          <polygon points="100,25 95,100 100,90 105,100" fill="hsl(var(--color-primary))" />
          {/* South needle */}
          <polygon
            points="100,175 95,100 100,110 105,100"
            fill="hsl(var(--color-primary))"
            opacity="0.4"
          />
        </g>

        {/* Center circle */}
        <circle cx="100" cy="100" r="8" fill="hsl(var(--color-secondary))" opacity="0.6" />
        <circle cx="100" cy="100" r="4" fill="hsl(var(--color-primary))" />

        {/* Inner decorative circles */}
        <circle
          cx="100"
          cy="100"
          r="50"
          fill="none"
          stroke="hsl(var(--color-primary))"
          strokeWidth="0.5"
          opacity="0.2"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
}
