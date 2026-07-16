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
 * List-page controls — chips, density toggle, sort dropdown, pagination,
 * empty state. All driven by the `ListFilters` URL contract; none of them
 * own state directly, they just dispatch partial updates back to the page.
 */

import { ChevronLeft, ChevronRight, Filter, Grid2x2, Rows3, Table2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  activeFilterCount,
  type DensityMode,
  type Distribution,
  type ListFilters,
  type Signal,
  type SortMode,
  type StabilityFacet,
} from "@/v1/lib/list-filters";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  filters: ListFilters;
  onChange: (next: Partial<ListFilters>) => void;
}

export function ActiveFilterChips({ filters, onChange }: ActiveFilterChipsProps) {
  const { t } = useTranslation(["list", "collector"]);
  const chips: Chip[] = [];

  // Facet values (e.g. "receiver", "traces") are internal identifiers, not
  // display text — resolve them through the same `collector:listV1.facets`
  // keys `FacetPanel` already uses so chip labels stay localized and never
  // drift from the facet panel's option copy.
  function facetLabel(
    facet: "type" | "signal" | "stability" | "distribution",
    value: string
  ): string {
    return t(`listV1.facets.${facet}.options.${value}`, { ns: "collector" });
  }

  if (filters.q.trim().length > 0) {
    chips.push({
      key: `q:${filters.q}`,
      label: t("chips.search", { value: filters.q }),
      onRemove: () => onChange({ q: "" }),
    });
  }

  function removeFrom<T extends string>(arrKey: keyof ListFilters, value: T) {
    const current = filters[arrKey] as unknown as readonly T[];
    onChange({ [arrKey]: current.filter((v) => v !== value) } as Partial<ListFilters>);
  }

  filters.types.forEach((type) =>
    chips.push({
      key: `type:${type}`,
      label: t("chips.type", { value: facetLabel("type", type) }),
      onRemove: () => removeFrom<CollectorComponentType>("types", type),
    })
  );
  filters.signals.forEach((signal) =>
    chips.push({
      key: `signal:${signal}`,
      label: t("chips.signal", { value: facetLabel("signal", signal) }),
      onRemove: () => removeFrom<Signal>("signals", signal),
    })
  );
  filters.stabilities.forEach((stability) =>
    chips.push({
      key: `stability:${stability}`,
      label: t("chips.stability", { value: facetLabel("stability", stability) }),
      onRemove: () => removeFrom<StabilityFacet>("stabilities", stability),
    })
  );
  filters.distributions.forEach((distribution) =>
    chips.push({
      key: `dist:${distribution}`,
      label: t("chips.distribution", { value: facetLabel("distribution", distribution) }),
      onRemove: () => removeFrom<Distribution>("distributions", distribution),
    })
  );
  if (filters.version) {
    chips.push({
      key: `version:${filters.version}`,
      label: t("chips.version", { value: filters.version }),
      onRemove: () => onChange({ version: null }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="td-chips" aria-label={t("chips.ariaLabel")}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="td-chip"
          onClick={chip.onRemove}
          aria-label={t("chips.removeAriaLabel", { label: chip.label })}
        >
          <span>{chip.label}</span>
          <X className="td-chip__x" aria-hidden focusable="false" />
        </button>
      ))}
      <button
        type="button"
        className="td-chip td-chip--clear"
        onClick={() =>
          onChange({
            q: "",
            types: [],
            signals: [],
            stabilities: [],
            distributions: [],
            version: null,
            page: 1,
          })
        }
      >
        {t("chips.clearAll")}
      </button>
    </div>
  );
}

export interface DensityToggleProps {
  value: DensityMode;
  onChange: (next: DensityMode) => void;
}

const DENSITY_OPTIONS: Array<{ value: DensityMode; icon: React.ReactNode }> = [
  { value: "cards", icon: <Grid2x2 className="h-4 w-4" aria-hidden /> },
  { value: "compact", icon: <Rows3 className="h-4 w-4" aria-hidden /> },
  { value: "table", icon: <Table2 className="h-4 w-4" aria-hidden /> },
];

export function DensityToggle({ value, onChange }: DensityToggleProps) {
  const { t } = useTranslation("list");
  return (
    <div className="td-density" role="group" aria-label={t("density.ariaLabel")}>
      {DENSITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`td-density__btn ${value === opt.value ? "td-density__btn--active" : ""}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          <span>{t(`density.${opt.value}`)}</span>
        </button>
      ))}
    </div>
  );
}

export interface SortDropdownProps {
  value: SortMode;
  onChange: (next: SortMode) => void;
}

const SORT_MODES: readonly SortMode[] = ["name", "updated", "stability"];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const { t } = useTranslation("list");
  return (
    <label className="td-sort">
      <span className="td-sort__label">{t("sort.label")}</span>
      <select
        className="td-sort__select"
        value={value}
        onChange={(e) => onChange(e.target.value as SortMode)}
      >
        {SORT_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`sort.${mode}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation("list");
  if (totalPages <= 1) return null;
  return (
    <nav className="td-pagination" aria-label={t("pagination.ariaLabel")}>
      <button
        type="button"
        className="td-pagination__btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label={t("pagination.previousAriaLabel")}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden focusable="false" />
        {t("pagination.previous")}
      </button>
      <span className="td-pagination__status" aria-live="polite">
        {t("pagination.status", { page, totalPages })}
      </span>
      <button
        type="button"
        className="td-pagination__btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label={t("pagination.nextAriaLabel")}
      >
        {t("pagination.next")}
        <ChevronRight className="h-4 w-4" aria-hidden focusable="false" />
      </button>
    </nav>
  );
}

export interface EmptyStateProps {
  onClearAll?: () => void;
  hasActiveFilters: boolean;
}

export function EmptyState({ onClearAll, hasActiveFilters }: EmptyStateProps) {
  const { t } = useTranslation("list");
  return (
    <div className="td-empty" role="status" aria-live="polite">
      <p className="td-empty__title">{t("emptyState.title")}</p>
      <p className="td-empty__lead">
        {hasActiveFilters ? t("emptyState.leadFiltered") : t("emptyState.leadUnfiltered")}
      </p>
      {hasActiveFilters && onClearAll && (
        <button type="button" className="td-btn td-btn--outline-regular" onClick={onClearAll}>
          {t("emptyState.clearAll")}
        </button>
      )}
    </div>
  );
}

export interface FacetDrawerToggleProps {
  filters: ListFilters;
  onClick: () => void;
}

export function FacetDrawerToggle({ filters, onClick }: FacetDrawerToggleProps) {
  const { t } = useTranslation("list");
  const count = activeFilterCount(filters);
  return (
    <button
      type="button"
      className="td-facet-toggle"
      onClick={onClick}
      aria-label={
        count === 0
          ? t("facetToggle.openAriaLabel")
          : t("facetToggle.openWithCountAriaLabel", { count })
      }
    >
      <Filter className="h-4 w-4" aria-hidden focusable="false" />
      <span>{t("facetToggle.label")}</span>
      {count > 0 && <span className="td-facet-toggle__badge">{count}</span>}
    </button>
  );
}
