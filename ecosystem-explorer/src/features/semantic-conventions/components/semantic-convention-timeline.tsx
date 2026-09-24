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

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineData, TimelineEvent, TimelineLaneDef } from "../types";
import { computeTimelineRange } from "../utils/timeline-layout";
import { EVENT_TYPES } from "../utils/timeline-colors";
import {
  TimelineFilterBar,
  type TimelineDomainFilter,
  type TimelineScope,
  type TimelineTypeFilter,
} from "./timeline-filter-bar";
import { TimelineLegend } from "./timeline-legend";
import { TimelineChart, type TimelineLaneGroup } from "./timeline-chart";
import { TimelineDetailPanel } from "./timeline-detail-panel";

interface SemanticConventionTimelineProps {
  data: TimelineData;
}

interface TimelineFilters {
  scope: TimelineScope;
  domain: TimelineDomainFilter;
  eventType: TimelineTypeFilter;
}

const DEFAULT_FILTERS: TimelineFilters = { scope: "major", domain: "all", eventType: "all" };

function eventsInScope(events: TimelineEvent[], scope: TimelineScope) {
  return events.filter((event) => scope === "all" || event.major);
}

function domainOptionsFor(
  lanes: TimelineLaneDef[],
  events: TimelineEvent[],
  eventType: TimelineTypeFilter
) {
  return lanes.filter((lane) =>
    events.some(
      (event) => event.lane === lane.id && (eventType === "all" || event.type === eventType)
    )
  );
}

function typeOptionsFor(events: TimelineEvent[], domain: TimelineDomainFilter) {
  return EVENT_TYPES.filter((type) =>
    events.some((event) => event.type === type && (domain === "all" || event.lane === domain))
  );
}

/*
 * Every filter change is resolved against the other two before it is stored, so state only ever
 * holds a combination that can produce a result: a filter whose value the new selection strands
 * drops back to "all" rather than surviving hidden and silently reselecting itself once another
 * change makes it valid again. Domain is resolved first against the event type and the type then
 * against the resolved domain, which keeps the two consistent no matter which one the user just
 * changed. Reconciling here (rather than while deriving the render output) keeps the component
 * free of render-phase state updates; the initial defaults are valid for any dataset, and the
 * timeline only mounts once its data has loaded, so there is no other entry point to cover.
 */
function reconcileFilters(data: TimelineData, next: TimelineFilters): TimelineFilters {
  const scopedEvents = eventsInScope(data.events, next.scope);
  const domain =
    next.domain === "all" ||
    domainOptionsFor(data.lanes, scopedEvents, next.eventType).some(
      (lane) => lane.id === next.domain
    )
      ? next.domain
      : "all";
  const eventType =
    next.eventType === "all" || typeOptionsFor(scopedEvents, domain).includes(next.eventType)
      ? next.eventType
      : "all";
  return { scope: next.scope, domain, eventType };
}

export function SemanticConventionTimeline({ data }: SemanticConventionTimelineProps) {
  const { t, i18n } = useTranslation("semantic-conventions");
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";

  const [{ scope, domain, eventType }, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detailRef = useRef<HTMLElement>(null);

  const updateFilters = useCallback(
    (change: Partial<TimelineFilters>) =>
      setFilters((current) => reconcileFilters(data, { ...current, ...change })),
    [data]
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    // On stacked layouts, bring the response to the selection into view.
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start" });
      detailRef.current?.focus({ preventScroll: true });
    }
  }

  const range = useMemo(() => computeTimelineRange(data.events), [data.events]);

  const scopeFilteredEvents = useMemo(
    () => eventsInScope(data.events, scope),
    [data.events, scope]
  );

  /*
   * The dropdown options are dynamic, not the dataset's full static lists: a domain or event
   * type only appears as a choice if it can actually produce a result given the *other* active
   * filter, so picking anything from either list can never land on an empty timeline.
   */
  const domainOptions = useMemo(
    () => domainOptionsFor(data.lanes, scopeFilteredEvents, eventType),
    [data.lanes, scopeFilteredEvents, eventType]
  );

  const typeOptions = useMemo(
    () => typeOptionsFor(scopeFilteredEvents, domain),
    [scopeFilteredEvents, domain]
  );

  const visibleEvents = useMemo(() => {
    return scopeFilteredEvents
      .filter((event) => domain === "all" || event.lane === domain)
      .filter((event) => eventType === "all" || event.type === eventType)
      .sort(
        (a: TimelineEvent, b: TimelineEvent) =>
          a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
      );
  }, [scopeFilteredEvents, domain, eventType]);

  const visibleTypes = useMemo(
    () => EVENT_TYPES.filter((type) => visibleEvents.some((event) => event.type === type)),
    [visibleEvents]
  );

  const laneGroups: TimelineLaneGroup[] = useMemo(() => {
    return data.lanes
      .map((lane) => ({ lane, events: visibleEvents.filter((event) => event.lane === lane.id) }))
      .filter((group) => group.events.length > 0);
  }, [data.lanes, visibleEvents]);

  // Mirrors the reference file's fallback: if the current selection has dropped out of the
  // filtered set (or nothing has been explicitly selected yet), fall back to the first visible
  // event. Derived directly during render rather than synced via an effect, since it's a pure
  // function of `visibleEvents` and `selectedId`.
  const selectedEvent = useMemo(() => {
    const explicit = selectedId
      ? visibleEvents.find((event) => event.id === selectedId)
      : undefined;
    return explicit ?? visibleEvents[0] ?? null;
  }, [visibleEvents, selectedId]);
  const effectiveSelectedId = selectedEvent?.id ?? null;

  function handleReset() {
    setFilters(DEFAULT_FILTERS);
    setSelectedId(null);
  }

  return (
    <div className="border-border bg-card overflow-clip rounded-lg border">
      <TimelineFilterBar
        scope={scope}
        domain={domain}
        eventType={eventType}
        domainOptions={domainOptions}
        typeOptions={typeOptions}
        onScopeChange={(scope) => updateFilters({ scope })}
        onDomainChange={(domain) => updateFilters({ domain })}
        onEventTypeChange={(eventType) => updateFilters({ eventType })}
        onReset={handleReset}
      />
      <TimelineLegend types={visibleTypes} />
      <p className="border-border/60 text-muted-foreground border-b px-4 py-3 text-xs">
        {t("timeline.readingNote")}
      </p>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0">
          <TimelineChart
            laneGroups={laneGroups}
            range={range}
            selectedId={effectiveSelectedId}
            locale={locale}
            onSelect={handleSelect}
          />
          <p
            role="status"
            className="border-border/60 text-muted-foreground border-t px-4 py-3 text-xs"
          >
            {t("timeline.status.summary", {
              milestones: t("timeline.status.milestoneCount", { count: visibleEvents.length }),
              domains: t("timeline.status.domainCount", { count: laneGroups.length }),
            })}
          </p>
        </div>
        <aside
          ref={detailRef}
          tabIndex={-1}
          aria-label={t("timeline.detail.heading")}
          className="border-border/60 bg-card focus-visible:ring-primary scroll-mt-24 border-t focus-visible:ring-2 focus-visible:outline-none lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <h2 className="text-muted-foreground px-6 pt-5 text-xs font-semibold tracking-wide uppercase">
            {t("timeline.detail.heading")}
          </h2>
          <TimelineDetailPanel event={selectedEvent} locale={locale} />
        </aside>
      </div>
    </div>
  );
}
