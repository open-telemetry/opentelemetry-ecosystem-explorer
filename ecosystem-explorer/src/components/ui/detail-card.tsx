/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React from "react";

interface DetailCardProps {
  children: React.ReactNode;
  className?: string;
  withGrid?: boolean;
  withHoverEffect?: boolean;
}

export function DetailCard({
  children,
  className = "",
  withGrid = false,
  withHoverEffect = false,
}: DetailCardProps) {
  const patternId = React.useId().replace(/:/g, "-");

  return (
    <div
      className={`group border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-6 ${
        withHoverEffect
          ? "hover:border-secondary/40 hover:bg-card hover:shadow-secondary/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          : ""
      } ${className}`}
    >
      {withGrid && (
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-primary"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
        </div>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
