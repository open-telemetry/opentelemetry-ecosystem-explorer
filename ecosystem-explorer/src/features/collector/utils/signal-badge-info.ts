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
import type { IndexComponent } from "@/types/collector";

/** Fixed display order for signal badges, independent of the source data's array order. */
export const SIGNAL_ORDER = ["metrics", "traces", "logs", "profiles"] as const;

export type CollectorSignal = (typeof SIGNAL_ORDER)[number];

/**
 * Returns the signals present on a component, filtered down to the known/displayable
 * set and ordered consistently for badge rendering. Unrecognized signal names (e.g. a
 * future signal not yet supported by the UI) are silently ignored here.
 */
export function getPresentSignals(component: Pick<IndexComponent, "signals">): CollectorSignal[] {
  const present = new Set(component.signals ?? []);
  return SIGNAL_ORDER.filter((signal) => present.has(signal));
}
