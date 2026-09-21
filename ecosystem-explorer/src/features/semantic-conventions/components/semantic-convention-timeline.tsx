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

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineData, TimelineEvent } from "../types";
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

export function SemanticConventionTimeline({ data }: SemanticConventionTimelineProps) {
  const { t, i18n } = useTranslation("semantic-conventions");
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";

  const [scope, setScope] = useState<TimelineScope>("major");
  const [domain, setDomain] = useState<TimelineDomainFilter>("all");
  const [eventType, setEventType] = useState<TimelineTypeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const range = useMemo(() => computeTimelineRange(data.events), [data.events]);

  const scopeFilteredEvents = useMemo(
    () => data.events.filter((event) => scope === "all" || event.major),
    [data.events, scope]
  );

  /*
   * The dropdown options are dynamic, not the dataset's full static lists: a domain or event
   * type only appears as a choice if it can actually produce a result given the *other* active
   * filter, so picking anything from either list can never land on an empty timeline. Domain
   * options are checked against the raw (not-yet-resolved) event-type filter first, and type
   * options against the resolved domain, which keeps the two mutually consistent no matter which
   * one the user just changed (each render re-derives both from scratch, so a value that becomes
   * incompatible always falls back to "all" rather than silently pointing at a dead end).
   */
  const domainOptions = useMemo(
    () =>
      data.lanes.filter((lane) =>
        scopeFilteredEvents.some(
          (event) => event.lane === lane.id && (eventType === "all" || event.type === eventType)
        )
      ),
    [data.lanes, scopeFilteredEvents, eventType]
  );
  const effectiveDomain: TimelineDomainFilter =
    domain === "all" || domainOptions.some((lane) => lane.id === domain) ? domain : "all";

  const typeOptions = useMemo(
    () =>
      EVENT_TYPES.filter((type) =>
        scopeFilteredEvents.some(
          (event) =>
            event.type === type && (effectiveDomain === "all" || event.lane === effectiveDomain)
        )
      ),
    [scopeFilteredEvents, effectiveDomain]
  );
  const effectiveEventType: TimelineTypeFilter =
    eventType === "all" || typeOptions.includes(eventType) ? eventType : "all";

  const visibleEvents = useMemo(() => {
    return scopeFilteredEvents
      .filter((event) => effectiveDomain === "all" || event.lane === effectiveDomain)
      .filter((event) => effectiveEventType === "all" || event.type === effectiveEventType)
      .sort(
        (a: TimelineEvent, b: TimelineEvent) =>
          a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
      );
  }, [scopeFilteredEvents, effectiveDomain, effectiveEventType]);

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
    setScope("major");
    setDomain("all");
    setEventType("all");
    setSelectedId(null);
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <TimelineFilterBar
        scope={scope}
        domain={effectiveDomain}
        eventType={effectiveEventType}
        domainOptions={domainOptions}
        typeOptions={typeOptions}
        onScopeChange={setScope}
        onDomainChange={setDomain}
        onEventTypeChange={setEventType}
        onReset={handleReset}
      />
      <TimelineLegend />
      <p className="border-border/60 text-muted-foreground border-b px-4 py-3 text-xs">
        {t("timeline.readingNote")}
      </p>
      <TimelineChart
        laneGroups={laneGroups}
        range={range}
        selectedId={effectiveSelectedId}
        locale={locale}
        onSelect={setSelectedId}
      />
      <p
        role="status"
        className="border-border/60 text-muted-foreground border-t px-4 py-3 text-xs"
      >
        {t("timeline.status.summary", { count: visibleEvents.length, lanes: laneGroups.length })}
      </p>
      <TimelineDetailPanel event={selectedEvent} locale={locale} />
    </div>
  );
}
