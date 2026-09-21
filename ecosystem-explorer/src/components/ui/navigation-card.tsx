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
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface NavigationCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  /**
   * "default" puts the icon beside the text once the card is wide enough (used for the two-up
   * landing grids). "featured" stacks the icon above the text and trails the description with a
   * circular arrow button, for a single hero-style card. "compact" is a dense icon+text row with
   * the arrow as a circular button at the end, for cards that share a column.
   */
  variant?: "default" | "featured" | "compact";
}

function GridPattern({ patternId }: { patternId: string }) {
  return (
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
  );
}

function ArrowButton() {
  return (
    <div className="border-border/50 bg-background/50 text-muted-foreground group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-hover:translate-x-1">
      <ArrowRight className="h-4 w-4" />
    </div>
  );
}

export function NavigationCard({
  title,
  description,
  href,
  icon,
  variant = "default",
}: NavigationCardProps) {
  const patternId = `grid${href.replace(/\//g, "-")}`;

  if (variant === "compact") {
    return (
      <Link to={href} className="group block h-full">
        <div className="border-border/60 bg-surface-card shadow-surface hover:border-primary/50 hover:bg-card hover:shadow-primary/15 hover:shadow-surface-hover relative flex h-full items-center gap-4 overflow-hidden rounded-lg border p-5 transition-all duration-300 hover:-translate-y-1">
          <GridPattern patternId={patternId} />

          <div className="border-border/50 bg-background/50 text-primary group-hover:border-primary/50 group-hover:bg-primary/10 relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border transition-colors">
            {icon}
          </div>

          <div className="relative z-10 min-w-0 flex-1">
            <h3 className="group-hover:text-primary mb-1 text-lg font-semibold text-[hsl(var(--secondary-hsl))] transition-colors">
              {title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          </div>

          <div className="relative z-10">
            <ArrowButton />
          </div>
        </div>
      </Link>
    );
  }

  const featured = variant === "featured";

  return (
    <Link to={href} className="group block h-full">
      <div className="border-border/60 bg-surface-card shadow-surface hover:border-primary/50 hover:bg-card hover:shadow-primary/15 hover:shadow-surface-hover relative flex h-full flex-col overflow-hidden rounded-lg border p-5 transition-all duration-300 hover:-translate-y-1 sm:p-8">
        <GridPattern patternId={patternId} />

        <div
          className={`relative z-10 flex flex-1 flex-col gap-4 ${featured ? "" : "sm:flex-row"}`}
        >
          <div className="flex-shrink-0">
            <div
              className={`border-border/50 bg-background/50 text-primary group-hover:border-primary/50 group-hover:bg-primary/10 flex items-center justify-center rounded-lg border transition-colors ${
                featured ? "h-20 w-20" : "h-24 w-24 sm:h-32 sm:w-32"
              }`}
            >
              {icon}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="group-hover:text-primary text-xl font-semibold text-[hsl(var(--secondary-hsl))] transition-colors sm:text-2xl">
                {title}
              </h3>

              {!featured && (
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-5 w-5 flex-shrink-0 transition-all duration-300 group-hover:translate-x-1" />
              )}
            </div>

            <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
          </div>
        </div>

        {featured && (
          <div className="relative z-10 mt-4">
            <ArrowButton />
          </div>
        )}

        <div className="absolute -right-1 -bottom-1 h-20 w-20 opacity-0 transition-all duration-300 group-hover:scale-110 group-hover:opacity-100">
          <svg viewBox="0 0 64 64" className="h-full w-full">
            <path
              d="M64 64 L64 32 L48 32 L48 48 L32 48 L32 64 Z"
              style={{ fill: "hsl(var(--secondary-hsl) / 0.5)" }}
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
