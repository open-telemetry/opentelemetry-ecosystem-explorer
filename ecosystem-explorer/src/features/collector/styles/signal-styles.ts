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
import type { CollectorSignal } from "../utils/signal-badge-info";
import type { SignalBadgeStyles } from "@/components/ui/signal-badge";

/**
 * Mirrors the Java Agent's FILTER_STYLES color formula (low-opacity bg + border,
 * ring/glow on active) for visual consistency across the app. Metrics and Traces
 * reuse the exact colors Java Agent already uses for the same underlying OTel
 * signals (green for metrics, blue for traces/spans); Logs and Profiles extend the
 * same palette with new colors since Java Agent has no equivalent badges for them.
 */
export const SIGNAL_STYLES: Record<CollectorSignal, SignalBadgeStyles> = {
  metrics: {
    active:
      "bg-green-500/40 border-green-400 text-green-900 dark:text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.3)] ring-1 ring-green-400/50",
    inactive:
      "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400/70 hover:border-green-500/50 hover:bg-green-500/10",
  },
  traces: {
    active:
      "bg-blue-500/40 border-blue-400 text-blue-900 dark:text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/50",
    inactive:
      "bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400/70 hover:border-blue-500/50 hover:bg-blue-500/10",
  },
  logs: {
    active:
      "bg-amber-500/40 border-amber-400 text-amber-900 dark:text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50",
    inactive:
      "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400/70 hover:border-amber-500/50 hover:bg-amber-500/10",
  },
  profiles: {
    active:
      "bg-pink-500/40 border-pink-400 text-pink-900 dark:text-pink-100 shadow-[0_0_15px_rgba(236,72,153,0.3)] ring-1 ring-pink-400/50",
    inactive:
      "bg-pink-500/5 border-pink-500/20 text-pink-700 dark:text-pink-400/70 hover:border-pink-500/50 hover:bg-pink-500/10",
  },
};

/** Mirrors Java Agent's `getTelemetryFilterClasses` for the Collector signal filter buttons. */
export function getSignalFilterClasses(signal: CollectorSignal, isActive: boolean): string {
  const styles = SIGNAL_STYLES[signal];
  return isActive ? styles.active : styles.inactive;
}
