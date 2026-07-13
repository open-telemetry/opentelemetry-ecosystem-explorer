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
 * Facet primitives — small generic controls that the FacetPanel composes
 * for the list page (Phase 4). Each primitive is data-driven via plain
 * arrays so a new facet (e.g. vendor) is just a config entry, not a new
 * component.
 *
 *   - <CheckboxFacet>  multi-select with counts; values render in stable order
 *   - <SearchFacet>    debounced text input
 *   - <SelectFacet>    native `<select>` dropdown (used for Version)
 */

import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface FacetOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  /** Optional swatch color shown next to the label (e.g. type-stripe color). */
  swatch?: string;
}

export interface CheckboxFacetProps<T extends string = string> {
  title: string;
  options: FacetOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}

export function CheckboxFacet<T extends string = string>({
  title,
  options,
  selected,
  onChange,
}: CheckboxFacetProps<T>) {
  const headingId = useId();
  const set = new Set(selected);

  function toggle(value: T) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // Sorted to match the canonical order `listFilters` serialize/parse uses,
    // so checkbox-emitted state equals what a URL round-trip produces.
    onChange(Array.from(next).sort());
  }

  return (
    <fieldset className="td-facet" aria-labelledby={headingId}>
      <legend id={headingId} className="td-facet__title">
        {title}
      </legend>
      <ul className="td-facet__options">
        {options.map((opt) => (
          <li key={opt.value} className="td-facet__option">
            <label className="td-facet__label">
              <input
                type="checkbox"
                checked={set.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="td-facet__input"
              />
              {opt.swatch && (
                <span
                  className="td-facet__swatch"
                  style={{ backgroundColor: opt.swatch }}
                  aria-hidden
                />
              )}
              <span className="td-facet__name">{opt.label}</span>
              {typeof opt.count === "number" && (
                <span className="td-facet__count">{opt.count}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export interface SearchFacetProps {
  /** Section heading; also labels the input. The consumer owns the copy. */
  title: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  /** Debounce ms before firing onChange. Default 250. */
  debounceMs?: number;
}

export function SearchFacet({
  title,
  placeholder,
  value,
  onChange,
  debounceMs = 250,
}: SearchFacetProps) {
  const headingId = useId();
  const [local, setLocal] = useState(value);
  const [lastProp, setLastProp] = useState(value);
  const debounced = useDebouncedValue(local, debounceMs);

  // Reflect external `value` changes (e.g. the panel's "Clear all") into the
  // input. Render-time sync per React's "storing information from previous
  // renders" idiom — the repo's `react-hooks/set-state-in-effect` lint rule
  // forbids the effect-based alternative.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (value !== lastProp) {
    setLastProp(value);
    setLocal(value);
  }

  // Emit only when the user's edits settle. Keyed on `debounced` alone: adding
  // `value` would re-fire the stale pre-clear text when the parent clears.
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="td-facet" role="search" aria-labelledby={headingId}>
      <div id={headingId} className="td-facet__title">
        {title}
      </div>
      <div className="td-facet__search">
        <Search className="td-facet__search-icon" aria-hidden focusable="false" />
        <input
          type="search"
          className="td-facet__search-input"
          placeholder={placeholder}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          aria-label={title}
        />
      </div>
    </div>
  );
}

export interface SelectFacetProps {
  title: string;
  options: FacetOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  /** Label for the null-value option (e.g. "Latest" on a version select). The consumer owns the copy. */
  emptyLabel: string;
}

export function SelectFacet({ title, options, value, onChange, emptyLabel }: SelectFacetProps) {
  const headingId = useId();
  return (
    <div className="td-facet" aria-labelledby={headingId}>
      <div id={headingId} className="td-facet__title">
        {title}
      </div>
      <select
        className="td-facet__select"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        aria-label={title}
      >
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
