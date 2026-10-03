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

import {
  HISTORY_SCHEMA_VERSION,
  type AcceptedHistory,
  type AcceptedHistoryEvent,
  type HistoryManifest,
  type HistorySource,
  type TimelineData,
} from "../types";

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const DATE_BASES = ["changelog-heading", "release-published-at"];
const REVIEW_STATUSES = ["accepted", "unreviewed"];

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Source whose repository contains `url`, or undefined for an unrelated URL. */
function sourceForUrl(sources: HistorySource[], url: string): HistorySource | undefined {
  return sources.find((source) => url.startsWith(`${source.repository}/`));
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Checks that `sources.json` is consistent with the authoritative `timeline.json`. Returns
 * human-readable problems; an empty list means the pair is valid.
 */
export function validateHistory(timeline: TimelineData, manifest: HistoryManifest): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (manifest.schemaVersion !== HISTORY_SCHEMA_VERSION) {
    fail(`schemaVersion must be ${HISTORY_SCHEMA_VERSION}, got ${manifest.schemaVersion}`);
  }

  const sourceIds = new Set<string>();
  for (const source of manifest.sources) {
    if (sourceIds.has(source.id)) fail(`duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    if (!isHttpsUrl(source.repository) || source.repository.endsWith("/")) {
      fail(`source ${source.id}: repository must be an https URL without a trailing slash`);
    }
    if (source.mode === "frozen") {
      if ("reviewedStart" in source)
        fail(`source ${source.id}: frozen sources have no reviewedStart`);
    } else if (!source.reviewedStart || !COMMIT_SHA.test(source.reviewedStart.commit)) {
      fail(`source ${source.id}: reviewedStart.commit must be a 40-character SHA`);
    }
  }

  const releasesByKey = new Map<string, HistoryManifest["releases"][number]>();
  for (const release of manifest.releases) {
    if (releasesByKey.has(release.key)) fail(`release key mapped more than once: ${release.key}`);
    releasesByKey.set(release.key, release);
    const source = manifest.sources.find((s) => s.id === release.source);
    if (!source) fail(`release ${release.key}: unknown source ${release.source}`);
    if (!release.tag) fail(`release ${release.key}: tag is required`);
    if (release.commit !== undefined && !COMMIT_SHA.test(release.commit)) {
      fail(`release ${release.key}: commit must be a 40-character SHA`);
    }
    if (source && source.mode !== "frozen" && release.commit === undefined) {
      fail(`release ${release.key}: monitored source ${source.id} requires an immutable commit`);
    }
    if (!DATE_BASES.includes(release.dateBasis)) {
      fail(`release ${release.key}: unknown dateBasis ${release.dateBasis}`);
    }
    if (release.baseline !== undefined) {
      const baseline = manifest.releases.find((r) => r.key === release.baseline);
      if (!baseline || baseline.source !== release.source) {
        fail(
          `release ${release.key}: baseline ${release.baseline} is not a release of ${release.source}`
        );
      }
    }
  }
  for (const key of Object.keys(timeline.dates)) {
    if (!releasesByKey.has(key)) fail(`dates key ${key} has no source mapping`);
  }
  for (const key of releasesByKey.keys()) {
    if (!(key in timeline.dates)) fail(`release mapping ${key} has no entry in dates`);
  }

  for (const source of manifest.sources) {
    if (source.mode === "frozen" || !source.reviewedStart?.tag) continue;
    const release = manifest.releases.find(
      (r) => r.source === source.id && r.tag === source.reviewedStart.tag
    );
    if (!release || release.commit !== source.reviewedStart.commit) {
      fail(`source ${source.id}: reviewedStart tag and commit do not match a mapped release`);
    }
  }

  const laneIds = new Set(timeline.lanes.map((lane) => lane.id));
  const eventsById = new Map(timeline.events.map((event) => [event.id, event]));
  if (eventsById.size !== timeline.events.length) fail("timeline event IDs are not unique");
  for (const event of timeline.events) {
    if (!laneIds.has(event.lane)) fail(`event ${event.id}: unknown lane ${event.lane}`);
    if (event.release !== null) {
      if (!releasesByKey.has(event.release))
        fail(`event ${event.id}: release ${event.release} has no mapping`);
      if (event.date !== timeline.dates[event.release]) {
        fail(`event ${event.id}: date ${event.date} differs from dates[${event.release}]`);
      }
    }
    if (!isHttpsUrl(event.source) || !sourceForUrl(manifest.sources, event.source)) {
      fail(`event ${event.id}: source is not an https URL inside a declared repository`);
    }
  }

  const bound = new Set<string>();
  for (const binding of manifest.lanes) {
    if (!laneIds.has(binding.lane)) fail(`lane binding for unknown lane ${binding.lane}`);
    if (bound.has(binding.lane)) fail(`lane ${binding.lane} is bound more than once`);
    bound.add(binding.lane);
    if (binding.namespaces.length === 0) fail(`lane ${binding.lane}: namespaces must not be empty`);
    const migration = binding.migration;
    if (migration) {
      const event = eventsById.get(migration.eventId);
      if (!event || event.lane !== binding.lane || event.type !== "moved") {
        fail(
          `lane ${binding.lane}: migration event ${migration.eventId} must be a moved event in the lane`
        );
      }
      for (const id of [migration.from, migration.to]) {
        if (!sourceIds.has(id))
          fail(`lane ${binding.lane}: migration references unknown source ${id}`);
      }
      if (migration.from === migration.to)
        fail(`lane ${binding.lane}: migration must change source`);
    }
  }
  for (const id of laneIds) {
    if (!bound.has(id)) fail(`lane ${id} has no binding`);
  }

  for (const evidence of manifest.evidence) {
    const event = eventsById.get(evidence.eventId);
    if (!event) fail(`evidence references unknown event ${evidence.eventId}`);
    if (!sourceIds.has(evidence.source))
      fail(`evidence for ${evidence.eventId}: unknown source ${evidence.source}`);
    if (!REVIEW_STATUSES.includes(evidence.reviewStatus)) {
      fail(`evidence for ${evidence.eventId}: unknown reviewStatus ${evidence.reviewStatus}`);
    }
    if (evidence.release !== undefined && event && evidence.release !== event.release) {
      fail(
        `evidence for ${evidence.eventId}: release ${evidence.release} differs from the event's`
      );
    }
    for (const link of evidence.links) {
      if (!isHttpsUrl(link) || !sourceForUrl(manifest.sources, link)) {
        fail(
          `evidence for ${evidence.eventId}: ${link} is not an https URL inside a declared repository`
        );
      }
    }
  }

  return errors;
}

/**
 * Builds the accepted-history view from `timeline.json` and `sources.json`. Event fields are
 * copied unchanged; source identity and accepted evidence are added alongside. Unreviewed
 * evidence is dropped. Output order is fixed: releases by version, events by date then ID.
 */
export function projectAcceptedHistory(
  timeline: TimelineData,
  manifest: HistoryManifest
): AcceptedHistory {
  const errors = validateHistory(timeline, manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid semantic-convention history:\n- ${errors.join("\n- ")}`);
  }

  const releaseKey = (legacyKey: string) => {
    const release = manifest.releases.find((r) => r.key === legacyKey)!;
    return `${release.source}@${release.tag}`;
  };

  const eventFor = (event: TimelineData["events"][number]): AcceptedHistoryEvent => ({
    ...event,
    sourceId: sourceForUrl(manifest.sources, event.source)!.id,
    releaseKey: event.release === null ? null : releaseKey(event.release),
    evidence: manifest.evidence
      .filter((e) => e.eventId === event.id && e.reviewStatus === "accepted")
      .map((e) => ({
        source: e.source,
        releaseKey: e.release === undefined ? null : releaseKey(e.release),
        namespaces: [...e.namespaces].sort(byString),
        links: [...e.links].sort(byString),
        reviewStatus: "accepted" as const,
      })),
  });

  return {
    schemaVersion: manifest.schemaVersion,
    sources: [...manifest.sources]
      .sort((a, b) => byString(a.id, b.id))
      .map((source) => ({
        id: source.id,
        repository: source.repository,
        mode: source.mode,
        paths: [...source.paths].sort(byString),
        ...(source.mode === "frozen" ? {} : { reviewedStart: source.reviewedStart }),
      })),
    releases: [...manifest.releases]
      .sort((a, b) => byString(a.source, b.source) || compareVersions(a.key, b.key))
      .map((release) => ({
        key: releaseKey(release.key),
        legacyKey: release.key,
        source: release.source,
        tag: release.tag,
        ...(release.commit === undefined ? {} : { commit: release.commit }),
        ...(release.baseline === undefined ? {} : { baseline: releaseKey(release.baseline) }),
        date: timeline.dates[release.key],
        dateBasis: release.dateBasis,
      })),
    lanes: timeline.lanes.map((lane) => {
      const binding = manifest.lanes.find((b) => b.lane === lane.id)!;
      return {
        ...lane,
        namespaces: [...binding.namespaces].sort(byString),
        ...(binding.migration ? { migration: binding.migration } : {}),
        events: timeline.events
          .filter((event) => event.lane === lane.id)
          .sort((a, b) => byString(a.date, b.date) || byString(a.id, b.id))
          .map(eventFor),
      };
    }),
  };
}
