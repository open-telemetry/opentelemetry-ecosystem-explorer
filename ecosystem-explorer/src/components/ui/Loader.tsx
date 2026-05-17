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
import { Loader2 } from "lucide-react";

type LoaderProps = {
  /**
   * Size of the loader.
   * "lg" is for full-page states and Suspense fallbacks.
   * "sm" is for inline/compact states.
   */
  size?: "sm" | "lg";
  /** Optional additional CSS classes */
  className?: string;
  /** Optional text to display alongside the loader */
  label?: string;
};

/**
 * A unified Loader component for consistent loading states across the application.
 */
export function Loader({ size = "lg", className = "", label }: LoaderProps) {
  if (size === "sm") {
    return (
      <div
        className={`flex items-center gap-3 py-2 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="text-primary h-4 w-4 animate-spin" aria-hidden="true" />
        {label && <span className="text-muted-foreground text-sm font-medium">{label}</span>}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[400px] flex-col items-center justify-center space-y-6 px-4 py-12 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative">
        {/* Glow effect */}
        <div className="bg-primary/20 absolute inset-0 animate-pulse rounded-full blur-2xl" />

        <div className="bg-card border-primary/10 relative inline-flex animate-pulse rounded-full border p-6 shadow-[0_0_50px_hsl(var(--primary-hsl)/0.15)]">
          <Loader2 className="text-primary h-12 w-12 animate-spin" aria-hidden="true" />
        </div>
      </div>

      {label && (
        <div className="space-y-2">
          <p className="text-foreground text-lg font-semibold tracking-tight">{label}</p>
          <p className="text-muted-foreground text-sm">This may take a moment</p>
        </div>
      )}
    </div>
  );
}
