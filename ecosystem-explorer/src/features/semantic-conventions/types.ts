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

export type TimelineEventType =
  "domain" | "baseline" | "stability" | "change" | "deprecation" | "removed" | "moved";

export interface TimelineLaneDef {
  id: string;
  title: string;
  subtitle: string;
}

export interface TimelineEvent {
  id: string;
  lane: string;
  release: string | null;
  type: TimelineEventType;
  short: string;
  title: string;
  detail: string;
  source: string;
  major: boolean;
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  transition?: string;
  dateBasis?: "specification-commit";
  commit?: string;
  pullRequest?: number;
  firstRelease?: string;
  lineageSource?: string;
}

export interface TimelineData {
  lanes: TimelineLaneDef[];
  events: TimelineEvent[];
  /** Release version -> ISO release date (UTC), not necessarily every patch release. */
  dates: Record<string, string>;
}

/*
 * Accepted-history contract. `timeline.json` stays the authoritative, hand-curated record of
 * accepted events; `sources.json` is a sidecar that qualifies it with source and revision
 * identity. Candidates and processing state are deliberately not part of this contract.
 */

export const HISTORY_SCHEMA_VERSION = 1;

/** Repository-qualified identity, e.g. `semantic-conventions`. */
export type HistorySourceId = string;

/** How a release date was established; mirrors the bases documented in the data README. */
export type ReleaseDateBasis = "changelog-heading" | "release-published-at";

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
      /** Accepted history covers this revision; later changes are unreviewed. */
      reviewedStart: HistoryRevision;
    })
  | (HistorySourceBase & {
      /** Discovered from commits, with no release tags (GenAI). */
      mode: "commit";
      /** Accepted history covers this revision; later commits are unreviewed. */
      reviewedStart: HistoryRevision;
    })
  | (HistorySourceBase & {
      /** Referenced by existing events but never monitored. */
      mode: "frozen";
    });

/**
 * Maps a bare `timeline.json` release key to its source. The date itself stays in `dates`.
 * `baseline` is the nearest ancestor release in the same source (a comparison baseline, not a
 * timeline compatibility-baseline event).
 */
export interface HistoryRelease {
  key: string;
  source: HistorySourceId;
  tag: string;
  commit?: string;
  baseline?: string;
  dateBasis: ReleaseDateBasis;
}

export interface HistoryLaneBinding {
  lane: string;
  /** Upstream model namespaces (directories under `model/`) this lane covers. */
  namespaces: string[];
  /** A boundary where this lane's conventions moved between sources. */
  migration?: { eventId: string; from: HistorySourceId; to: HistorySourceId };
}

export interface HistoryEvidence {
  eventId: string;
  source: HistorySourceId;
  /** Bare release key from `dates`, when the evidence belongs to a release. */
  release?: string;
  namespaces: string[];
  links: string[];
  /** Only `accepted` evidence is published. */
  reviewStatus: "accepted" | "unreviewed";
}

/** Hand-authored `sources.json`. */
export interface HistoryManifest {
  schemaVersion: number;
  sources: HistorySource[];
  releases: HistoryRelease[];
  lanes: HistoryLaneBinding[];
  evidence: HistoryEvidence[];
}

/** An accepted timeline event plus derived source identity. */
export interface AcceptedHistoryEvent extends TimelineEvent {
  /** Source whose repository `source` points into. */
  sourceId: HistorySourceId;
  /** `{source}@{tag}` for `release`, or null for pre-release events. */
  releaseKey: string | null;
  evidence: AcceptedHistoryEvidence[];
}

export interface AcceptedHistoryEvidence {
  source: HistorySourceId;
  releaseKey: string | null;
  namespaces: string[];
  links: string[];
  reviewStatus: "accepted";
}

export interface AcceptedHistoryLane extends TimelineLaneDef {
  namespaces: string[];
  migration?: { eventId: string; from: HistorySourceId; to: HistorySourceId };
  events: AcceptedHistoryEvent[];
}

export interface AcceptedHistoryRelease {
  /** `{source}@{tag}` */
  key: string;
  /** Bare key used by `timeline.json`. */
  legacyKey: string;
  source: HistorySourceId;
  tag: string;
  commit?: string;
  /** Comparison baseline as a qualified release key. */
  baseline?: string;
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  dateBasis: ReleaseDateBasis;
}

export interface AcceptedHistorySource {
  id: HistorySourceId;
  repository: string;
  mode: HistorySource["mode"];
  paths: string[];
  /** Absent for frozen sources, which are not monitored. */
  reviewedStart?: HistoryRevision;
}

/** Published accepted history (`accepted-history.json`). */
export interface AcceptedHistory {
  schemaVersion: number;
  sources: AcceptedHistorySource[];
  releases: AcceptedHistoryRelease[];
  lanes: AcceptedHistoryLane[];
}
