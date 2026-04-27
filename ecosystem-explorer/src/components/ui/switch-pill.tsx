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
import type { JSX } from "react";

interface SwitchPillProps {
  checked: boolean;
  onClick: () => void;
  ariaLabel: string;
  ariaRequired?: boolean;
  /**
   * `solid` (default) is the normal opaque switch. `dashed` adds a dashed
   * border + slight transparency so the user reads "this is the default
   * position; nothing stored". Used by ToggleControl when value is null.
   */
  variant?: "solid" | "dashed";
}

/**
 * Rounded-pill toggle switch. Used for boolean leaf controls (ToggleControl,
 * FlagControl) and for the section-card enable toggle in GroupRenderer.
 */
export function SwitchPill({
  checked,
  onClick,
  ariaLabel,
  ariaRequired,
  variant = "solid",
}: SwitchPillProps): JSX.Element {
  const dashed = variant === "dashed";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-required={ariaRequired || undefined}
      data-variant={variant}
      onClick={onClick}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background",
        checked ? "bg-primary" : "bg-border",
        dashed ? "border border-dashed border-[hsl(var(--border-hsl))] opacity-70" : "",
      ].join(" ")}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
