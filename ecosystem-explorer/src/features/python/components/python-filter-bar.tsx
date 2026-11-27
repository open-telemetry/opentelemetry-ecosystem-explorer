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
import { useTranslation } from "react-i18next";
import {
  METRICS_FACETS,
  activeFilterCount,
  type FacetCounts,
  type MetricsFacet,
  type PythonFilters,
} from "@/features/python/utils/catalogue";
import { metricsTone, semconvTone, toneClasses } from "@/features/python/styles/filter-styles";

interface PythonFilterBarProps {
  filters: PythonFilters;
  /** Search text as typed, which can differ from `filters.q` by surrounding whitespace. */
  search: string;
  semconvOptions: string[];
  counts: FacetCounts;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<PythonFilters>) => void;
  onReset: () => void;
}

function toggle<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

// Layout only: each option's colours come from its tone, as in the Java agent filter bar.
const BUTTON =
  "rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all duration-200 focus:ring-2 focus:ring-primary/40 focus:outline-none";

export function PythonFilterBar({
  filters,
  search,
  semconvOptions,
  counts,
  onSearchChange,
  onChange,
  onReset,
}: PythonFilterBarProps) {
  const { t } = useTranslation("python");
  const hasActive = activeFilterCount(filters) > 0 || search.trim() !== "";

  return (
    <div
      role="group"
      aria-label={t("list.filters.groupAriaLabel")}
      className="border-border/60 bg-surface-card shadow-surface space-y-6 rounded-lg border p-6"
    >
      {hasActive && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="text-primary text-sm font-semibold hover:underline"
          >
            {t("list.filters.reset")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="python-search" className="text-muted-foreground text-sm font-medium">
          {t("list.filters.searchLabel")}
        </label>
        <input
          id="python-search"
          type="text"
          value={search}
          placeholder={t("list.filters.searchPlaceholder")}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-border/60 bg-background/80 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 flex h-[42px] w-full rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:outline-none"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-muted-foreground text-sm font-medium">
            {t("metrics.label")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {METRICS_FACETS.map((value: MetricsFacet) => {
              const on = filters.metrics.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ metrics: toggle(filters.metrics, value) })}
                  className={`${BUTTON} ${toneClasses(metricsTone(value), on)}`}
                >
                  {t(`metrics.${value}`)} ({counts.metrics[value]})
                </button>
              );
            })}
          </div>
        </fieldset>

        {semconvOptions.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="text-muted-foreground text-sm font-medium">
              {t("semconv.label")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {semconvOptions.map((value) => {
                const on = filters.semconv.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ semconv: toggle(filters.semconv, value) })}
                    className={`${BUTTON} ${toneClasses(semconvTone(value), on)}`}
                  >
                    {t(`semconv.${value}`, { defaultValue: value })} ({counts.semconv[value] ?? 0})
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}
