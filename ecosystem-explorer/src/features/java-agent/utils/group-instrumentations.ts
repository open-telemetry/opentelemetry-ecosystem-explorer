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
