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

type BadgeVariant = "primary" | "success" | "info" | "warning" | "muted";

interface GlowBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  withGlow?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { base: string; glow: string }> = {
  primary: {
    base: "bg-primary/10 border-primary/30 text-primary",
    glow: "shadow-sm shadow-primary/20",
  },
  success: {
    base: "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400",
    glow: "shadow-sm shadow-green-500/20",
  },
  info: {
    base: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
    glow: "shadow-sm shadow-blue-500/20",
  },
  warning: {
    base: "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400",
    glow: "shadow-sm shadow-orange-500/20",
  },
  muted: {
    base: "bg-muted border-border/50 text-muted-foreground",
    glow: "",
  },
};

export function GlowBadge({
  children,
  variant = "primary",
  withGlow = false,
  className = "",
}: GlowBadgeProps) {
  const styles = variantStyles[variant];
  const glowClass = withGlow ? styles.glow : "";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${styles.base} ${glowClass} ${className}`}
    >
      {children}
    </span>
  );
}
