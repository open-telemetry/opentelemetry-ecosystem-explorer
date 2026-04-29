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
import { useState, type JSX } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ConfigNode } from "@/types/configuration";
import { SchemaRenderer } from "./schema-renderer";
import { SectionCardShell } from "./section-card-shell";

export const GENERAL_SECTION_KEY = "general";
export const GENERAL_SECTION_LABEL = "General";

export interface GeneralSectionCardProps {
  leafChildren: ConfigNode[];
}

/**
 * Auto-promotes any root-level leaf fields (toggle, select, etc.) into a
 * collapsible card so they participate in the TOC + scroll-spy. The set of
 * fields is schema-driven: future schema versions adding new root leaves are
 * picked up automatically.
 */
export function GeneralSectionCard({ leafChildren }: GeneralSectionCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <SectionCardShell sectionKey={GENERAL_SECTION_KEY}>
      <header className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Collapse ${GENERAL_SECTION_LABEL}` : `Expand ${GENERAL_SECTION_LABEL}`
          }
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <h3 className="text-foreground truncate text-base font-semibold">
          {GENERAL_SECTION_LABEL}
        </h3>
      </header>
      {expanded && (
        <div className="space-y-3">
          {leafChildren.map((child) => (
            <SchemaRenderer key={child.key} node={child} depth={1} path={child.key} />
          ))}
        </div>
      )}
    </SectionCardShell>
  );
}
