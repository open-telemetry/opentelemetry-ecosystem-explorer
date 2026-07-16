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
import { Tooltip } from "@/components/ui/tooltip";

export type SignalBadgeSize = "default" | "compact";

const SIGNAL_BADGE_SIZE_CLASSES: Record<SignalBadgeSize, string> = {
  default: "text-xs px-2 py-1 rounded border-2",
  compact: "text-xs px-1.5 py-0.5 rounded border",
};

export interface SignalBadgeStyles {
  active: string;
  inactive: string;
}

interface SignalBadgeProps {
  label: string;
  tooltip: string;
  ariaLabel: string;
  active: boolean;
  styles: SignalBadgeStyles;
  size?: SignalBadgeSize;
}

/**
 * Ecosystem-agnostic badge: a tooltipped, keyboard-focusable span used to flag a
 * telemetry signal or target on a component/instrumentation card. Callers supply
 * the label/tooltip text and the active/inactive class-string pair for their own
 * color palette, so this component carries no domain vocabulary of its own.
 */
export function SignalBadge({
  label,
  tooltip,
  ariaLabel,
  active,
  styles,
  size = "default",
}: SignalBadgeProps) {
  const cls = SIGNAL_BADGE_SIZE_CLASSES[size];

  return (
    <Tooltip content={tooltip}>
      <span
        aria-label={ariaLabel}
        className={`${cls} focus:ring-ring cursor-help transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
          active ? styles.active : styles.inactive
        }`}
        tabIndex={0}
      >
        {label}
      </span>
    </Tooltip>
  );
}
