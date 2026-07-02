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
 * Canonical home-page stat counters. Mirrors the band shown on
 * opentelemetry.io's home page (`/`) as of 2026-05-19. Values are strings so
 * we can render the "+" suffix without numeric formatting concerns.
 *
 * When opentelemetry.io's counters refresh, update the values here. The
 * `<StatsBand>` component consumes this list directly; an automated sync
 * with opentelemetry.io is a possible follow-up.
 */

export interface StatItem {
  /** Stable identifier for lookups and React keys; decoupled from `label` so a
   *  display-copy change never breaks consumers that key off a specific stat. */
  key: string;
  /** Visible counter label (e.g. "Languages"). */
  label: string;
  /** Pre-formatted counter value (e.g. "12+"). */
  value: string;
  /** Link target. Internal routes use react-router; external go to opentelemetry.io. */
  href: string;
  /** When true, renders as a `target="_blank"` external link. */
  external?: boolean;
}

/** Stable key for the headline ecosystem-scale counter (see INTEGRATIONS_STAT_VALUE). */
const INTEGRATIONS_STAT_KEY = "integrations";

export const HOME_STATS: StatItem[] = [
  {
    key: "languages",
    label: "Languages",
    value: "12+",
    href: "https://opentelemetry.io/docs/languages/",
    external: true,
  },
  {
    key: "collector-components",
    label: "Collector Components",
    value: "200+",
    href: "/collector",
  },
  {
    key: INTEGRATIONS_STAT_KEY,
    label: "Integrations",
    value: "1005+",
    href: "https://opentelemetry.io/ecosystem/registry/",
    external: true,
  },
  {
    key: "vendors",
    label: "Vendors",
    value: "102+",
    href: "https://opentelemetry.io/ecosystem/vendors/",
    external: true,
  },
];

/**
 * Headline ecosystem-scale counter ("Integrations"), single-sourced from
 * HOME_STATS so the stats band and the GlobalSearch placeholder can never
 * drift apart. Looked up by the stable `key` rather than the display label, so
 * renaming the label leaves this intact. Falls back to an empty string only if
 * the stat is removed entirely — callers should tolerate that gracefully.
 */
export const INTEGRATIONS_STAT_VALUE =
  HOME_STATS.find((stat) => stat.key === INTEGRATIONS_STAT_KEY)?.value ?? "";
