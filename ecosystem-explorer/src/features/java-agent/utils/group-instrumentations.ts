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
import type { InstrumentationData } from "@/types/javaagent";
import { getInstrumentationDisplayName } from "./format";

export interface InstrumentationGroup {
  displayName: string;
  instrumentations: InstrumentationData[];
}

/**
 * Groups instrumentations by their resolved display name.
 *
 * Instrumentations sharing the same display name (either explicit `display_name`
 * or the fallback generated from `name`) are combined into a single group.
 * Groups are sorted alphabetically by display name, and instrumentations within
 * each group are sorted alphabetically by their raw `name`.
 */
export function groupInstrumentationsByDisplayName(
  instrumentations: InstrumentationData[]
): InstrumentationGroup[] {
  const groupMap = new Map<string, InstrumentationData[]>();

  for (const instr of instrumentations) {
    const displayName = getInstrumentationDisplayName(instr);
    const existing = groupMap.get(displayName);
    if (existing) {
      existing.push(instr);
    } else {
      groupMap.set(displayName, [instr]);
    }
  }

  const groups: InstrumentationGroup[] = [];
  for (const [displayName, members] of groupMap) {
    groups.push({
      displayName,
      instrumentations: members.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  groups.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return groups;
}
