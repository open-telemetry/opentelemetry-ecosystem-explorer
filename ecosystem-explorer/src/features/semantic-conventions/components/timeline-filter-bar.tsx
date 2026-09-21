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

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineEventType, TimelineLaneDef } from "../types";

export type TimelineScope = "major" | "all";
export type TimelineDomainFilter = "all" | string;
export type TimelineTypeFilter = "all" | TimelineEventType;

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}

function SelectField({ id, label, value, onChange, children }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-muted-foreground text-xs font-semibold">
        {label}
      </label>
      <div className="relative min-w-[11rem]">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-border/60 bg-card text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 w-full cursor-pointer appearance-none rounded-md border px-3 py-2 pr-7 text-sm font-medium shadow-sm transition-all duration-200 focus:ring-2 focus:outline-none"
        >
          {children}
        </select>
        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

interface TimelineFilterBarProps {
  scope: TimelineScope;
  domain: TimelineDomainFilter;
  eventType: TimelineTypeFilter;
  /** Lanes that can produce at least one result given the other active filters. */
  domainOptions: TimelineLaneDef[];
  /** Event types that can produce at least one result given the other active filters. */
  typeOptions: TimelineEventType[];
  onScopeChange: (scope: TimelineScope) => void;
  onDomainChange: (domain: TimelineDomainFilter) => void;
  onEventTypeChange: (eventType: TimelineTypeFilter) => void;
  onReset: () => void;
}

export function TimelineFilterBar({
  scope,
  domain,
  eventType,
  domainOptions,
  typeOptions,
  onScopeChange,
  onDomainChange,
  onEventTypeChange,
  onReset,
}: TimelineFilterBarProps) {
  const { t } = useTranslation("semantic-conventions");

  return (
    <div className="border-border/60 flex flex-wrap items-end gap-4 border-b p-4">
      <SelectField
        id="timeline-scope"
        label={t("timeline.filters.scope.label")}
        value={scope}
        onChange={(value) => onScopeChange(value as TimelineScope)}
      >
        <option value="major">{t("timeline.filters.scope.major")}</option>
        <option value="all">{t("timeline.filters.scope.all")}</option>
      </SelectField>

      <SelectField
        id="timeline-domain"
        label={t("timeline.filters.domain.label")}
        value={domain}
        onChange={onDomainChange}
      >
        <option value="all">{t("timeline.filters.domain.all")}</option>
        {domainOptions.map((lane) => (
          <option key={lane.id} value={lane.id}>
            {lane.title}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="timeline-type"
        label={t("timeline.filters.type.label")}
        value={eventType}
        onChange={(value) => onEventTypeChange(value as TimelineTypeFilter)}
      >
        <option value="all">{t("timeline.filters.type.all")}</option>
        {typeOptions.map((type) => (
          <option key={type} value={type}>
            {t(`timeline.filters.type.${type}`)}
          </option>
        ))}
      </SelectField>

      <button
        type="button"
        onClick={onReset}
        className="text-primary hover:text-primary/80 ml-auto cursor-pointer rounded-md px-2 py-2 text-sm font-semibold transition-colors"
      >
        {t("timeline.filters.reset")}
      </button>
    </div>
  );
}
