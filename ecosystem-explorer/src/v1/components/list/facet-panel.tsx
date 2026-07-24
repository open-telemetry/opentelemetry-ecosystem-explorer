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
 * FacetPanel — left rail on the list page. Sticky on desktop; on mobile it
 * collapses into a drawer toggled by the FacetDrawerToggle button. The open
 * drawer is modal: dialog semantics, focus trapped inside, body scroll locked,
 * and Escape / scrim click / the close button all dismiss it, handing focus
 * back to whatever opened it.
 *
 * Composes the facets defined in the Phase 4 plan: Search · Type · Signal ·
 * Stability · Distribution · Version. The panel itself stays presentational —
 * all filter state lives in the parent (driven by the `listFilters` URL
 * contract), and the facet vocabularies derive from that contract's exported
 * arrays so the checkboxes can't drift from what `parseFilters` accepts.
 * Structural copy (panel/search/facet titles, and the ecosystem-agnostic Signal
 * vocabulary) lives in the `list` namespace, matching `controls.tsx`. Collector-specific
 * option vocabulary (type/stability/distribution values) stays in the `collector`
 * namespace's `listV1.facets` block, self-contained so the end-of-redesign cleanup can
 * drop the legacy `filters.*` keys without breaking v1.
 */

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import { DISTRIBUTIONS, SIGNALS, STABILITIES, TYPES } from "@/v1/lib/list-filters";
import type { Distribution, ListFilters, Signal, StabilityFacet } from "@/v1/lib/list-filters";
import { CheckboxFacet, type FacetOption, SearchFacet, SelectFacet } from "./facets";

// Swatch palette for the stability facet. Typed against the contract union so
// a newly added stability level fails typecheck until it gets a color.
const STABILITY_SWATCHES: Record<StabilityFacet, string> = {
  stable: "hsl(145 63% 42%)",
  beta: "hsl(200 85% 45%)",
  alpha: "hsl(38 95% 52%)",
  development: "hsl(220 9% 60%)",
  deprecated: "hsl(0 70% 50%)",
  unmaintained: "hsl(0 70% 50%)",
};

export interface FacetCounts {
  types?: Partial<Record<CollectorComponentType, number>>;
  signals?: Partial<Record<Signal, number>>;
  stabilities?: Partial<Record<StabilityFacet, number>>;
  distributions?: Partial<Record<Distribution, number>>;
}

export interface FacetPanelProps {
  filters: ListFilters;
  onChange: (next: Partial<ListFilters>) => void;
  versions?: string[];
  counts?: FacetCounts;
  /** Mobile: when true the panel is rendered inside a drawer overlay. */
  isOpen?: boolean;
  onClose?: () => void;
}

function withCounts<T extends string>(
  options: FacetOption<T>[],
  counts?: Partial<Record<T, number>>
): FacetOption<T>[] {
  if (!counts) return options;
  return options.map((opt) => ({ ...opt, count: counts[opt.value] }));
}

export function FacetPanel({
  filters,
  onChange,
  versions,
  counts,
  isOpen = false,
  onClose,
}: FacetPanelProps) {
  const { t } = useTranslation(["list", "collector"]);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDrawer = isOpen && onClose !== undefined;

  useEffect(() => {
    if (!isDrawer) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );

    // Captured before focus moves into the drawer so cleanup can hand it back
    // to the opener (the FacetDrawerToggle).
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusables()[0]?.focus();

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && panel.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = bodyOverflow;
      previouslyFocused?.focus();
    };
  }, [isDrawer, onClose]);

  // Every facet edit resets pagination: a new filter set is a new result set.
  const change = (next: Partial<ListFilters>) => onChange({ ...next, page: 1 });

  // Signal's vocabulary lives in the `list` namespace (it's ecosystem-agnostic,
  // defined by `list-filters.ts`'s SIGNALS array); type/stability/distribution
  // are collector-domain terms and stay in `collector`.
  function facetOptions<T extends string>(
    facet: "type" | "signal" | "stability" | "distribution",
    values: readonly T[],
    swatches?: Record<T, string>
  ): FacetOption<T>[] {
    return values.map((value) => ({
      value,
      swatch: swatches?.[value],
      label:
        facet === "signal"
          ? t(`facets.signal.options.${value}`)
          : t(`listV1.facets.${facet}.options.${value}`, { ns: "collector" }),
    }));
  }

  return (
    <>
      {isDrawer && <div className="td-facet-panel__scrim" aria-hidden="true" onClick={onClose} />}
      {/* A `div` with explicit roles rather than `aside`: ARIA in HTML forbids
          `role="dialog"` on `aside`, and the element must switch between rail
          (complementary) and modal drawer (dialog) semantics. */}
      <div
        ref={panelRef}
        className={`td-facet-panel ${isOpen ? "td-facet-panel--open" : ""}`}
        aria-label={t("facets.panel.label")}
        role={isDrawer ? "dialog" : "complementary"}
        aria-modal={isDrawer || undefined}
      >
        {onClose && (
          <button
            type="button"
            className="td-facet-panel__close"
            aria-label={t("facets.panel.close")}
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden focusable="false" />
          </button>
        )}

        <SearchFacet
          title={t("facets.search.title")}
          placeholder={t("facets.search.placeholder")}
          value={filters.q}
          onChange={(q) => change({ q })}
        />

        <CheckboxFacet
          title={t("facets.type.title")}
          options={withCounts(facetOptions("type", TYPES, TYPE_STRIPE_COLORS), counts?.types)}
          selected={filters.types}
          onChange={(types) => change({ types })}
        />

        <CheckboxFacet
          title={t("facets.signal.title")}
          options={withCounts(facetOptions("signal", SIGNALS), counts?.signals)}
          selected={filters.signals}
          onChange={(signals) => change({ signals })}
        />

        <CheckboxFacet
          title={t("facets.stability.title")}
          options={withCounts(
            facetOptions("stability", STABILITIES, STABILITY_SWATCHES),
            counts?.stabilities
          )}
          selected={filters.stabilities}
          onChange={(stabilities) => change({ stabilities })}
        />

        <CheckboxFacet
          title={t("facets.distribution.title")}
          options={withCounts(facetOptions("distribution", DISTRIBUTIONS), counts?.distributions)}
          selected={filters.distributions}
          onChange={(distributions) => change({ distributions })}
        />

        {versions && versions.length > 0 && (
          <SelectFacet
            title={t("facets.version.title")}
            options={versions.map((v) => ({ value: v, label: v }))}
            value={filters.version}
            onChange={(version) => change({ version })}
            emptyLabel={t("facets.version.latest")}
          />
        )}
      </div>
    </>
  );
}
