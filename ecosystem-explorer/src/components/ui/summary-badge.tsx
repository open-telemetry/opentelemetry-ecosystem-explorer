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

export interface SummaryBadgeProps {
  /** Plain-text count + label, e.g. "3 fields set" or "1 item". */
  children: string;
}

/**
 * Outlined chip in the secondary accent color, used to surface "X fields set"
 * / "N items" hints next to group, list and item labels. Distinct from the
 * grey "is used" pills that mark default values.
 */
export function SummaryBadge({ children }: SummaryBadgeProps): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full border border-secondary/40 px-2 py-0.5 text-[10px] font-medium tabular-nums leading-none text-secondary">
      {children}
    </span>
  );
}
