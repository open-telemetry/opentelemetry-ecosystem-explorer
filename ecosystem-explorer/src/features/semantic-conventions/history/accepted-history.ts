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
  EVENT_DATE_BASES,
  HISTORY_SCHEMA_VERSION,
  RELEASE_DATE_BASES,
  TIMELINE_EVENT_TYPES,
  type EventRevision,
  type TimelineData,
} from "../types";

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const SOURCE_MODES = ["release", "commit", "frozen"];

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value !== "";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDate(value: string): boolean {
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** `{source}@{tag}` for a release key, or `{source}@{commit}` for a commit revision. */
export function revisionKey(revision: EventRevision): string {
  return typeof revision === "string" ? revision : `${revision.source}@${revision.commit}`;
}

/**
 * Structural check of the hand-edited `timeline.json`. `validateHistory` only follows references
 * once this passes, so a missing or mistyped property is reported rather than thrown.
 */
function shapeErrors(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(data)) return ["timeline.json must be a JSON object"];

  if (typeof data.schemaVersion !== "number") errors.push("schemaVersion must be a number");
  if ("$schema" in data && typeof data.$schema !== "string") {
    errors.push("$schema must be a string");
  }

  const records = (name: string, check: (record: Json, at: string) => void) => {
    const list = data[name];
    if (!Array.isArray(list)) return errors.push(`${name} must be an array`);
    list.forEach((record, index) => {
      if (isObject(record)) check(record, `${name}[${index}]`);
      else errors.push(`${name}[${index}] must be an object`);
    });
  };
  const text = (record: Json, at: string, key: string, optional = false) => {
    if (optional && record[key] === undefined) return;
    if (!isString(record[key])) errors.push(`${at}.${key} must be a non-empty string`);
  };
  const strings = (record: Json, at: string, key: string) => {
    if (!isStringArray(record[key])) errors.push(`${at}.${key} must be an array of strings`);
  };

  records("sources", (source, at) => {
    text(source, at, "id");
    text(source, at, "repository");
    strings(source, at, "paths");
    if (typeof source.mode !== "string" || !SOURCE_MODES.includes(source.mode)) {
      errors.push(`${at}.mode must be one of ${SOURCE_MODES.join(", ")}`);
    } else if (source.mode !== "frozen") {
      const through = source.reviewedThrough;
      if (!isObject(through)) errors.push(`${at}.reviewedThrough must be an object`);
      else {
        text(through, `${at}.reviewedThrough`, "commit");
        text(through, `${at}.reviewedThrough`, "tag", true);
      }
    }
  });
  records("releases", (release, at) => {
    for (const key of ["key", "tag", "date", "dateBasis"]) text(release, at, key);
    text(release, at, "commit", true);
    text(release, at, "baseline", true);
  });
  records("lanes", (lane, at) => {
    for (const key of ["id", "title", "subtitle"]) text(lane, at, key);
    strings(lane, at, "namespaces");
    const migration = lane.migration;
    if (migration === undefined) return;
    if (!isObject(migration)) return void errors.push(`${at}.migration must be an object`);
    for (const key of ["eventId", "from", "to"]) text(migration, `${at}.migration`, key);
  });
  records("events", (event, at) => {
    for (const key of ["id", "lane", "type", "short", "title", "detail", "source", "date"]) {
      text(event, at, key);
    }
    if (typeof event.major !== "boolean") errors.push(`${at}.major must be a boolean`);
    const revision = event.revision;
    if (isObject(revision)) {
      text(revision, `${at}.revision`, "source");
      text(revision, `${at}.revision`, "commit");
    } else if (!isString(revision)) {
      errors.push(`${at}.revision must be a release key or a { source, commit } object`);
    }
    for (const key of ["transition", "dateBasis", "firstRelease", "lineageSource"]) {
      text(event, at, key, true);
    }
    if (event.pullRequest !== undefined && typeof event.pullRequest !== "number") {
      errors.push(`${at}.pullRequest must be a number`);
    }
    const evidence = event.evidence;
    if (evidence === undefined) return;
    if (!Array.isArray(evidence)) return void errors.push(`${at}.evidence must be an array`);
    evidence.forEach((item, index) => {
      const itemAt = `${at}.evidence[${index}]`;
      if (!isObject(item)) return void errors.push(`${itemAt} must be an object`);
      text(item, itemAt, "source");
      strings(item, itemAt, "namespaces");
      strings(item, itemAt, "links");
    });
  });
  return errors;
}

/**
 * Checks the authored `timeline.json`. Returns human-readable problems; an empty list means the
 * file is valid.
 */
export function validateHistory(input: unknown): string[] {
  const shape = shapeErrors(input);
  if (shape.length > 0) return shape;

  const data = input as TimelineData;
  const errors: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (data.schemaVersion !== HISTORY_SCHEMA_VERSION) {
    fail(`schemaVersion must be ${HISTORY_SCHEMA_VERSION}, got ${data.schemaVersion}`);
  }

  const sourcesById = new Map<string, TimelineData["sources"][number]>();
  for (const source of data.sources) {
    if (sourcesById.has(source.id)) fail(`duplicate source id: ${source.id}`);
    sourcesById.set(source.id, source);
    if (!isHttpsUrl(source.repository) || source.repository.endsWith("/")) {
      fail(`source ${source.id}: repository must be an https URL without a trailing slash`);
    }
    if (source.mode === "frozen") {
      if ("reviewedThrough" in source) {
        fail(`source ${source.id}: frozen sources have no reviewedThrough`);
      }
    } else if (!COMMIT_SHA.test(source.reviewedThrough.commit)) {
      fail(`source ${source.id}: reviewedThrough.commit must be a 40-character SHA`);
    }
  }

  const releasesByKey = new Map<string, TimelineData["releases"][number]>();
  const sourceOfKey = (key: string) => sourcesById.get(key.slice(0, Math.max(key.indexOf("@"), 0)));
  for (const release of data.releases) {
    if (releasesByKey.has(release.key)) fail(`duplicate release key: ${release.key}`);
    releasesByKey.set(release.key, release);
    const source = sourceOfKey(release.key);
    if (!source) fail(`release ${release.key}: key must be {source}@{tag} for a known source`);
    else if (release.key !== `${source.id}@${release.tag}`) {
      fail(`release ${release.key}: key does not match tag ${release.tag}`);
    }
    if (release.commit !== undefined && !COMMIT_SHA.test(release.commit)) {
      fail(`release ${release.key}: commit must be a 40-character SHA`);
    }
    if (source && source.mode !== "frozen" && release.commit === undefined) {
      fail(`release ${release.key}: monitored source ${source.id} requires an immutable commit`);
    }
    if (!(RELEASE_DATE_BASES as readonly string[]).includes(release.dateBasis)) {
      fail(`release ${release.key}: unknown dateBasis ${release.dateBasis}`);
    }
    if (!isIsoDate(release.date)) fail(`release ${release.key}: date ${release.date} is not ISO`);
  }
  for (const release of data.releases) {
    if (release.baseline === undefined) continue;
    const baseline = releasesByKey.get(release.baseline);
    if (!baseline || sourceOfKey(baseline.key) !== sourceOfKey(release.key)) {
      fail(
        `release ${release.key}: baseline ${release.baseline} is not a release of the same source`
      );
    }
  }
  for (const source of data.sources) {
    if (source.mode === "frozen" || !source.reviewedThrough.tag) continue;
    const release = releasesByKey.get(`${source.id}@${source.reviewedThrough.tag}`);
    if (!release || release.commit !== source.reviewedThrough.commit) {
      fail(`source ${source.id}: reviewedThrough tag and commit do not match a release`);
    }
  }

  const lanesById = new Map<string, TimelineData["lanes"][number]>();
  const laneOfNamespace = new Map<string, string>();
  for (const lane of data.lanes) {
    if (lanesById.has(lane.id)) fail(`duplicate lane id: ${lane.id}`);
    lanesById.set(lane.id, lane);
    if (lane.namespaces.length === 0) fail(`lane ${lane.id}: namespaces must not be empty`);
    for (const namespace of lane.namespaces) {
      const owner = laneOfNamespace.get(namespace);
      if (owner !== undefined && owner !== lane.id) {
        fail(`namespace ${namespace} is claimed by lanes ${owner} and ${lane.id}`);
      }
      laneOfNamespace.set(namespace, lane.id);
    }
  }

  const eventsById = new Map<string, TimelineData["events"][number]>();
  for (const event of data.events) {
    if (eventsById.has(event.id)) fail(`duplicate event id: ${event.id}`);
    eventsById.set(event.id, event);
    if (!lanesById.has(event.lane)) fail(`event ${event.id}: unknown lane ${event.lane}`);
    if (!(TIMELINE_EVENT_TYPES as readonly string[]).includes(event.type)) {
      fail(`event ${event.id}: unknown type ${event.type}`);
    }
    if (!isIsoDate(event.date)) fail(`event ${event.id}: date ${event.date} is not ISO`);
    if (!isHttpsUrl(event.source)) fail(`event ${event.id}: source must be an https URL`);

    const revision = event.revision;
    const dateBasis = event.dateBasis as string | undefined;
    if (dateBasis !== undefined && !(EVENT_DATE_BASES as readonly string[]).includes(dateBasis)) {
      fail(`event ${event.id}: unknown dateBasis ${dateBasis}`);
    } else if (typeof revision === "string" && dateBasis !== undefined) {
      fail(`event ${event.id}: a release revision takes its date basis from the release`);
    } else if (typeof revision !== "string" && dateBasis === undefined) {
      fail(`event ${event.id}: a commit revision requires a dateBasis`);
    }
    if (typeof revision === "string") {
      const release = releasesByKey.get(revision);
      if (!release) fail(`event ${event.id}: unknown release ${revision}`);
      else if (event.date !== release.date) {
        fail(`event ${event.id}: date ${event.date} differs from ${revision} (${release.date})`);
      }
    } else {
      if (!sourcesById.has(revision.source)) {
        fail(`event ${event.id}: revision references unknown source ${revision.source}`);
      }
      if (!COMMIT_SHA.test(revision.commit)) {
        fail(`event ${event.id}: revision commit must be a 40-character SHA`);
      }
    }

    for (const evidence of event.evidence ?? []) {
      const source = sourcesById.get(evidence.source);
      if (!source) fail(`evidence for ${event.id}: unknown source ${evidence.source}`);
      const laneNamespaces = lanesById.get(event.lane)?.namespaces ?? [];
      for (const namespace of evidence.namespaces) {
        if (!laneNamespaces.includes(namespace)) {
          fail(`evidence for ${event.id}: namespace ${namespace} is not in lane ${event.lane}`);
        }
      }
      for (const link of evidence.links) {
        if (!isHttpsUrl(link) || (source && !link.startsWith(`${source.repository}/`))) {
          fail(`evidence for ${event.id}: ${link} is not an https URL inside ${evidence.source}`);
        }
      }
    }
  }

  for (const lane of data.lanes) {
    const migration = lane.migration;
    if (!migration) continue;
    const event = eventsById.get(migration.eventId);
    if (!event || event.lane !== lane.id || event.type !== "moved") {
      fail(
        `lane ${lane.id}: migration event ${migration.eventId} must be a moved event in the lane`
      );
    }
    for (const id of [migration.from, migration.to]) {
      if (!sourcesById.has(id)) fail(`lane ${lane.id}: migration references unknown source ${id}`);
    }
    if (migration.from === migration.to) fail(`lane ${lane.id}: migration must change source`);
  }

  return errors;
}

/** Returns the authored data, or throws listing every problem. */
export function assertValidHistory(input: unknown): TimelineData {
  const errors = validateHistory(input);
  if (errors.length > 0) {
    throw new Error(`Invalid semantic-convention history:\n- ${errors.join("\n- ")}`);
  }
  return input as TimelineData;
}
