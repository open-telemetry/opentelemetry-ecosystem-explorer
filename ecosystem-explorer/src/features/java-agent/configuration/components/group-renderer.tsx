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
import type { GroupNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { getByPath, parsePath } from "@/lib/config-path";
import { countConfiguredLeaves } from "@/lib/state-summary";
import { SummaryBadge } from "@/components/ui/summary-badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { SwitchPill } from "@/components/ui/switch-pill";
import { TruncatedDescription } from "@/components/ui/truncated-description";
import { SchemaRenderer } from "./schema-renderer";
import { SectionCardShell } from "./section-card-shell";

const DEEP_NESTING_DEPTH = 3;

export interface GroupRendererProps {
  node: GroupNode;
  depth: number;
  path: string;
  /**
   * When true, skip the chevron + label header and render the body inline.
   * Set by parents that already named the choice (e.g. PluginSelectRenderer
   * showing "Batch" in its discriminator and not wanting a duplicate header
   * underneath). Only honored at depth >= 1.
   */
  headless?: boolean;
}

export function GroupRenderer({
  node,
  depth,
  path,
  headless = false,
}: GroupRendererProps): JSX.Element {
  const { state, setEnabled } = useConfigurationBuilder();
  const isTopLevel = depth === 0;
  const enabled = isTopLevel ? state.enabledSections[node.key] === true : true;
  const initialExpanded = isTopLevel ? enabled : false;
  const [expanded, setExpanded] = useState(initialExpanded);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (isTopLevel && prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (enabled) setExpanded(true);
  }

  const body = enabled ? (
    <div
      className={
        depth >= DEEP_NESTING_DEPTH ? "border-border/40 space-y-3 border-l pl-3" : "space-y-3"
      }
    >
      {node.children.map((child) => (
        <SchemaRenderer
          key={child.key}
          node={child}
          depth={depth + 1}
          path={path ? `${path}.${child.key}` : child.key}
        />
      ))}
    </div>
  ) : null;

  if (isTopLevel) {
    return (
      <SectionCardShell sectionKey={node.key}>
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {enabled && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                onClick={() => setExpanded((e) => !e)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            <h3 className="text-foreground truncate text-base font-semibold">{node.label}</h3>
            <StabilityBadge stability={node.stability} />
          </div>
          <SwitchPill
            checked={enabled}
            ariaLabel={`Enable ${node.label}`}
            onClick={() => setEnabled(node.key, !enabled)}
          />
        </header>
        {node.description && <TruncatedDescription text={node.description} />}
        {expanded && body}
      </SectionCardShell>
    );
  }

  const fieldsSet = countConfiguredLeaves(getByPath(state.values, parsePath(path)));

  return (
    <div className="space-y-2">
      {!headless && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
            onClick={() => setExpanded((e) => !e)}
            className="text-foreground hover:text-primary flex items-center gap-1 text-sm font-medium"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {node.label}
          </button>
          {fieldsSet > 0 && (
            <SummaryBadge>{`${fieldsSet} ${fieldsSet === 1 ? "field" : "fields"} set`}</SummaryBadge>
          )}
          {node.description && <InfoTooltip text={node.description} />}
        </div>
      )}
      {headless && node.description && <InfoTooltip text={node.description} />}
      {(headless || expanded) && body}
    </div>
  );
}
