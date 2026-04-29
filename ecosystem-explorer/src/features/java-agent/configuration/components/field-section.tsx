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
/* eslint-disable react-refresh/only-export-components -- compound component pattern: FieldSection is a compound (Object.assign) and useFieldSectionCanAdd is a thin context-reader hook, both legitimately co-located. */
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ConfigNodeBase, Constraints } from "@/types/configuration";
import type { ConfigValue } from "@/types/configuration-builder";
import { SummaryBadge } from "@/components/ui/summary-badge";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TruncatedDescription } from "@/components/ui/truncated-description";
import { countConfiguredLeaves } from "@/lib/state-summary";

type Level = "section" | "field";

interface FieldSectionContextValue {
  node: ConfigNodeBase;
  level: Level;
  value: ConfigValue | null | undefined;
  labelId: string;
  bodyId: string;
  open: boolean;
  setOpen: (next: boolean) => void;
  canAdd: boolean;
  headless: boolean;
  labelledBy?: string;
}

const FieldSectionContext = createContext<FieldSectionContextValue | null>(null);

function useFieldSection(): FieldSectionContextValue {
  const ctx = useContext(FieldSectionContext);
  if (!ctx) throw new Error("FieldSection.* must render inside <FieldSection>");
  return ctx;
}

export interface FieldSectionProps {
  node: ConfigNodeBase;
  level?: Level;
  value?: ConfigValue | null;
  defaultExpanded?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  headless?: boolean;
  labelledBy?: string;
  /**
   * Whether to render the wrapper as a labelled group (`role="group"` +
   * `aria-labelledby`). Defaults to true at level=field and false at
   * level=section. Set explicitly to false when an outer container already
   * provides the labelling — SectionCardShell at top-level group, or
   * ControlWrapper for list/map controls.
   */
  asGroup?: boolean;
  children: ReactNode;
}

function Root({
  node,
  level = "field",
  value,
  defaultExpanded,
  open: openProp,
  onOpenChange,
  headless = false,
  labelledBy,
  asGroup,
  children,
}: FieldSectionProps) {
  const labelId = useId();
  const bodyId = useId();
  // Body defaults to visible. Consumers that want collapse-by-default render
  // <FieldSection.Chevron/> and pass `defaultExpanded={false}` (or drive `open`
  // in controlled mode). Defaulting to true keeps no-chevron consumers visible.
  const initialOpen = defaultExpanded ?? true;
  const [openInternal, setOpenInternal] = useState(initialOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? (openProp as boolean) : openInternal;
  const setOpen = (next: boolean) => {
    if (!isControlled) setOpenInternal(next);
    onOpenChange?.(next);
  };

  const items = countItems(value);
  const constraints = (node as ConfigNodeBase & { constraints?: Constraints }).constraints;
  const canAdd = constraints?.maxItems == null || items < constraints.maxItems;

  const useGroupRole = asGroup ?? level === "field";
  const wrapperLabelledBy = labelledBy ?? (headless ? undefined : labelId);
  const wrapperProps: Record<string, string> = {};
  if (useGroupRole) wrapperProps.role = "group";
  if (wrapperLabelledBy) wrapperProps["aria-labelledby"] = wrapperLabelledBy;

  return (
    <FieldSectionContext.Provider
      value={{
        node,
        level,
        value,
        labelId,
        bodyId,
        open,
        setOpen,
        canAdd,
        headless,
        labelledBy,
      }}
    >
      <div className="space-y-2" {...wrapperProps}>
        {children}
      </div>
    </FieldSectionContext.Provider>
  );
}

function countItems(value: ConfigValue | null | undefined): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") return Object.keys(value).length;
  return 0;
}

function Header({ children }: { children: ReactNode }) {
  const { headless } = useFieldSection();
  if (headless) return null;
  return <div className="flex items-center gap-2">{children}</div>;
}

function Label() {
  const { node, level, labelId } = useFieldSection();
  if (level === "section") {
    return (
      <h3 id={labelId} className="text-foreground truncate text-base font-semibold">
        {node.label}
      </h3>
    );
  }
  return (
    <h4 id={labelId} className="text-foreground text-sm font-medium">
      {node.label}
    </h4>
  );
}

function Chevron() {
  const { node, open, setOpen, bodyId } = useFieldSection();
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      aria-label={open ? `Collapse ${node.label}` : `Expand ${node.label}`}
      onClick={() => setOpen(!open)}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function Body({ children }: { children: ReactNode }) {
  const { open, bodyId, headless } = useFieldSection();
  // Headless suppresses the header so collapsing would strand content;
  // otherwise honor `open`. The Root defaults `open=true`, so consumers that
  // don't render <Chevron/> (and don't pass `defaultExpanded`/`open`) get a
  // body that's always visible.
  if (!headless && !open) return null;
  return (
    <div id={bodyId} className={headless ? undefined : "mt-3"}>
      {children}
    </div>
  );
}

function Empty({ children }: { children?: ReactNode }) {
  return (
    <p role="status" className="text-muted-foreground text-xs italic">
      {children ?? "No items yet"}
    </p>
  );
}

function deriveBadgeText(
  node: ConfigNodeBase,
  value: ConfigValue | null | undefined
): string | null {
  if (node.controlType === "group") {
    const fields = countConfiguredLeaves(value ?? null);
    if (fields === 0) return null;
    return `${fields} ${fields === 1 ? "field" : "fields"} set`;
  }
  if (node.controlType === "key_value_map") {
    const n =
      value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : 0;
    if (n === 0) return null;
    return `${n} ${n === 1 ? "entry" : "entries"}`;
  }
  if (
    node.controlType === "list" ||
    node.controlType === "string_list" ||
    node.controlType === "number_list"
  ) {
    const n = Array.isArray(value) ? value.length : 0;
    if (n === 0) return null;
    return `${n} ${n === 1 ? "item" : "items"}`;
  }
  return null;
}

function Badge() {
  const { node, value } = useFieldSection();
  const text = deriveBadgeText(node, value);
  if (!text) return null;
  return <SummaryBadge>{text}</SummaryBadge>;
}

function Stability() {
  const { node } = useFieldSection();
  return <StabilityBadge stability={node.stability} />;
}

function Info() {
  const { node } = useFieldSection();
  if (!node.description) return null;
  return <InfoTooltip text={node.description} />;
}

function Description() {
  const { node, level, headless } = useFieldSection();
  if (headless) return null;
  if (level !== "section") return null;
  if (!node.description) return null;
  return <TruncatedDescription text={node.description} />;
}

function Action({ children }: { children: ReactNode }) {
  const { canAdd } = useFieldSection();
  return (
    <span className="ml-auto" hidden={!canAdd}>
      {children}
    </span>
  );
}

export function useFieldSectionCanAdd(): { canAdd: boolean } {
  const { canAdd } = useFieldSection();
  return { canAdd };
}

export const FieldSection = Object.assign(Root, {
  Header,
  Label,
  Chevron,
  Body,
  Empty,
  Badge,
  Stability,
  Info,
  Description,
  Action,
});
