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

/*
 * Colours for the Python catalogue's metrics and semantic-convention values, in the same
 * active/inactive shape the Java agent filters use. The class strings are written out in full
 * because Tailwind only generates classes it can find literally in the source.
 *
 * "Not specified" is slate, not a warning colour: null in the data means upstream did not say,
 * which is different from a known "no".
 */

import type { MetricsFacet } from "@/features/python/utils/catalogue";
import { UNKNOWN_SEMCONV } from "@/features/python/utils/catalogue";

export interface PythonTone {
  /** Filter button while its filter is on. */
  active: string;
  /** Filter button while its filter is off. */
  inactive: string;
  /** Static pill on a card or detail page (no hover). */
  badge: string;
  /** Solid colour for the V1 checkbox swatch. */
  swatch: string;
}

const GREEN: PythonTone = {
  active:
    "bg-green-500/40 border-green-400 text-green-900 dark:text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.3)] ring-1 ring-green-400/50",
  inactive:
    "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400/70 hover:border-green-500/50 hover:bg-green-500/10",
  badge: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
  swatch: "hsl(145 63% 42%)",
};

const AMBER: PythonTone = {
  active:
    "bg-amber-500/40 border-amber-400 text-amber-900 dark:text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50",
  inactive:
    "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400/70 hover:border-amber-500/50 hover:bg-amber-500/10",
  badge: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  swatch: "hsl(38 95% 52%)",
};

const PURPLE: PythonTone = {
  active:
    "bg-purple-500/40 border-purple-400 text-purple-900 dark:text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50",
  inactive:
    "bg-purple-500/5 border-purple-500/20 text-purple-700 dark:text-purple-400/70 hover:border-purple-500/50 hover:bg-purple-500/10",
  badge: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300",
  swatch: "hsl(270 60% 58%)",
};

const BLUE: PythonTone = {
  active:
    "bg-blue-500/40 border-blue-400 text-blue-900 dark:text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/50",
  inactive:
    "bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400/70 hover:border-blue-500/50 hover:bg-blue-500/10",
  badge: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
  swatch: "hsl(200 85% 45%)",
};

const SLATE: PythonTone = {
  active:
    "bg-slate-500/40 border-slate-400 text-slate-900 dark:text-slate-100 shadow-[0_0_15px_rgba(100,116,139,0.3)] ring-1 ring-slate-400/50",
  inactive:
    "bg-slate-500/5 border-slate-500/20 text-slate-600 dark:text-slate-400/80 hover:border-slate-500/50 hover:bg-slate-500/10",
  badge: "bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-300",
  swatch: "hsl(220 9% 60%)",
};

const METRICS_TONES: Record<MetricsFacet, PythonTone> = {
  supported: GREEN,
  unsupported: AMBER,
  unknown: SLATE,
};

export function metricsTone(metrics: MetricsFacet): PythonTone {
  return METRICS_TONES[metrics];
}

/** Migration is purple, unknown is slate, and any other status upstream adds is blue. */
export function semconvTone(semconv: string): PythonTone {
  if (semconv === UNKNOWN_SEMCONV) return SLATE;
  if (semconv === "migration") return PURPLE;
  return BLUE;
}

export function toneClasses(tone: PythonTone, isActive: boolean): string {
  return isActive ? tone.active : tone.inactive;
}
