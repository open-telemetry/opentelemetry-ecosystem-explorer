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
import { useState, useEffect, type JSX } from "react";
import type { ConfigNode } from "@/types/configuration";
import { SchemaRenderer } from "./schema-renderer";
import { SectionCardShell } from "./section-card-shell";
import { FieldSection } from "./field-section";
import { useSectionExpansion } from "./section-expansion-context";

export const GENERAL_SECTION_KEY = "general";
export const GENERAL_SECTION_LABEL = "General";

interface GeneralSectionCardProps {
  label: string;
  children: ConfigNode[];
  pathPrefix?: string;
  defaultExpanded?: boolean;
  sectionKey?: string;
  emptyMessage?: string;
}

export function GeneralSectionCard({
  label,
  children,
  pathPrefix = "",
  defaultExpanded = false,
  sectionKey = GENERAL_SECTION_KEY,
  emptyMessage,
}: GeneralSectionCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { signal } = useSectionExpansion();
  useEffect(() => {
    if (!signal) return;
    if (signal.action === "expand") setExpanded(true);
    if (signal.action === "collapse") setExpanded(false);
  }, [signal]);

  const headerNode = {
    controlType: "group" as const,
    key: "__general__",
    label,
    path: "",
  };
  return (
    <SectionCardShell sectionKey={sectionKey}>
      <FieldSection
        node={headerNode}
        level="section"
        asGroup={false}
        open={expanded}
        onOpenChange={setExpanded}
      >
        <FieldSection.Header>
          <FieldSection.Chevron />
          <FieldSection.Label />
        </FieldSection.Header>
        <FieldSection.Body>
          {children.length === 0 && emptyMessage ? (
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          ) : (
            <div className="space-y-3 pl-3">
              {children.map((child) => {
                const path = pathPrefix ? `${pathPrefix}.${child.key}` : child.key;
                return (
                  <div key={child.key} data-yaml-section-key={path}>
                    <SchemaRenderer node={child} depth={1} path={path} />
                  </div>
                );
              })}
            </div>
          )}
        </FieldSection.Body>
      </FieldSection>
    </SectionCardShell>
  );
}
