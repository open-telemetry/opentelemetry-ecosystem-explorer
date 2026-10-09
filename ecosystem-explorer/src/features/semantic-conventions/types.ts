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

export const TIMELINE_EVENT_TYPES = [
  "domain",
  "baseline",
  "stability",
  "change",
  "deprecation",
  "removed",
  "moved",
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

/*
 * `timeline.json` is the single hand-authored record of accepted semantic-convention history.
 * The timeline UI and the agent output read these same records. Candidates and processing state
 * are deliberately not part of this contract.
 */

export const HISTORY_SCHEMA_VERSION = 1;

/** Repository-qualified identity, e.g. `semantic-conventions`. */
export type HistorySourceId = string;

/** Upstream revision. `commit` is a full 40-character SHA. */
export interface HistoryRevision {
  tag?: string;
  commit: string;
}

interface HistorySourceBase {
  id: HistorySourceId;
  /** HTTPS repository URL without a trailing slash. */
  repository: string;
  /** Repository-relative paths that carry convention changes. */
  paths: string[];
}

export type HistorySource =
  | (HistorySourceBase & {
      /** Discovered from published releases (core). */
      mode: "release";
      /** Accepted history covers everything up to and including this revision. */
      reviewedThrough: HistoryRevision;
    })
  | (HistorySourceBase & {
      /** Discovered from commits, with no release tags (GenAI). */
      mode: "commit";
      /** Accepted history covers everything up to and including this revision. */
      reviewedThrough: HistoryRevision;
    })
  | (HistorySourceBase & {
      /** Referenced by existing events but never monitored. */
      mode: "frozen";
    });

/** How a release date was established; mirrors the bases documented in the data README. */
export const RELEASE_DATE_BASES = ["changelog-heading", "release-published-at"] as const;
export type ReleaseDateBasis = (typeof RELEASE_DATE_BASES)[number];

/**
 * How the date of an event with a commit revision was established, since there is no release
 * date to take: the specification commit's UTC committer date, or that of any other source.
 * Events with a release revision take their date from the release and carry no basis.
 */
export const EVENT_DATE_BASES = ["specification-commit", "commit-date"] as const;
export type EventDateBasis = (typeof EVENT_DATE_BASES)[number];

/** The frozen source whose commits carry `pullRequest` numbers shown as "spec PR". */
export const SPECIFICATION_SOURCE_ID = "opentelemetry-specification";

/**
 * A tagged release, keyed `{source}@{tag}` because two repositories can publish the same tag.
 * `baseline` is the nearest ancestor release of the same source (a comparison baseline, not a
 * timeline compatibility-baseline event).
 */
export interface HistoryRelease {
  key: string;
  tag: string;
  commit?: string;
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  dateBasis: ReleaseDateBasis;
  baseline?: string;
}

/** A revision of a commit-mode or frozen source, which has no release tag to cite. */
export interface CommitRevision {
  source: HistorySourceId;
  commit: string;
}

/** A release key (`{source}@{tag}`), or a commit of a source without releases. */
export type EventRevision = string | CommitRevision;

export interface EventEvidence {
  source: HistorySourceId;
  namespaces: string[];
  /** HTTPS links inside the source's repository. */
  links: string[];
}

export interface TimelineLaneDef {
  id: string;
  title: string;
  subtitle: string;
  /** Upstream model namespaces (directories under `model/`) this lane covers. */
  namespaces: string[];
  /** A boundary where this lane's conventions moved between sources. */
  migration?: { eventId: string; from: HistorySourceId; to: HistorySourceId };
}

export interface TimelineEvent {
  id: string;
  lane: string;
  revision: EventRevision;
  type: TimelineEventType;
  short: string;
  title: string;
  detail: string;
  source: string;
  major: boolean;
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  transition?: string;
  dateBasis?: EventDateBasis;
  /** A pull request of the revision's own source; only meaningful with a commit revision. */
  pullRequest?: number;
  firstRelease?: string;
  lineageSource?: string;
  evidence?: EventEvidence[];
}

export interface TimelineData {
  /** Editor hint pointing at the generated JSON Schema; ignored by validation. */
  $schema?: string;
  schemaVersion: number;
  sources: HistorySource[];
  releases: HistoryRelease[];
  lanes: TimelineLaneDef[];
  events: TimelineEvent[];
}
