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
import type { GroupNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { getByPath, parsePath } from "@/lib/config-path";
import { SwitchPill } from "@/components/ui/switch-pill";
import { SchemaRenderer } from "./schema-renderer";
import { SectionCardShell } from "./section-card-shell";
import { FieldSection } from "./field-section";

const DEEP_NESTING_DEPTH = 3;

export interface GroupRendererProps {
  node: GroupNode;
  depth: number;
  path: string;
  /**
   * When true, skip the chevron + label header and render the body inline.
   * Set by parents that already named the choice (e.g. PluginSelectRenderer
   * showing "Batch" in its discriminator and not wanting a duplicate header
   * underneath, or ListRenderer wrapping object-list items). Only honored at
   * depth >= 1.
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

  const value = getByPath(state.values, parsePath(path));

  const body = (
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
  );

  if (isTopLevel) {
    return (
      <SectionCardShell sectionKey={node.key}>
        <FieldSection
          node={node}
          level="section"
          value={value}
          asGroup={false}
          open={expanded}
          onOpenChange={setExpanded}
        >
          <FieldSection.Header>
            {enabled && <FieldSection.Chevron />}
            <FieldSection.Label />
            <FieldSection.Stability />
            <FieldSection.Action>
              <SwitchPill
                checked={enabled}
                ariaLabel={`Enable ${node.label}`}
                onClick={() => setEnabled(node.key, !enabled)}
              />
            </FieldSection.Action>
          </FieldSection.Header>
          <FieldSection.Description />
          {enabled && <FieldSection.Body>{body}</FieldSection.Body>}
        </FieldSection>
      </SectionCardShell>
    );
  }

  // Nested group (depth >= 1). When headless, the parent owns the visible label
  // (e.g. ListRenderer's item card header, PluginSelectRenderer's tablist), so
  // skip role="group" on the FieldSection wrapper too — otherwise it would
  // render an unnamed group.
  return (
    <FieldSection
      node={node}
      level="field"
      value={value}
      headless={headless}
      asGroup={!headless}
      open={expanded}
      onOpenChange={setExpanded}
    >
      <FieldSection.Header>
        <FieldSection.Chevron />
        <FieldSection.Label />
        <FieldSection.Badge />
        <FieldSection.Info />
      </FieldSection.Header>
      <FieldSection.Body>{body}</FieldSection.Body>
    </FieldSection>
  );
}
