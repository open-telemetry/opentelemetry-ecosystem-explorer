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

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { TIMELINE_EVENT_TYPES, type TimelineData } from "../types";
import { assertValidHistory, revisionKey, validateHistory } from "./accepted-history";

const timelinePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../public/data/semantic-conventions/timeline.json"
);

let text: string;
let data: TimelineData;

beforeAll(() => {
  text = readFileSync(timelinePath, "utf8");
  data = JSON.parse(text);
});

const clone = <T>(value: T): T => structuredClone(value);
const eventNamed = (id: string) => data.events.find((event) => event.id === id)!;

describe("authored history", () => {
  it("validates", () => {
    expect(validateHistory(data)).toEqual([]);
    expect(assertValidHistory(data)).toBe(data);
  });

  it("keeps every release under a source-qualified key, spec-era apart from core", () => {
    expect(data.releases).toHaveLength(48);
    expect(new Set(data.releases.map((r) => r.key)).size).toBe(48);
    for (const release of data.releases) {
      expect(release.key).toMatch(/^[a-z-]+@v\d+\.\d+\.\d+$/);
      expect(release.key.endsWith(`@${release.tag}`)).toBe(true);
    }
    const release = (key: string) => data.releases.find((r) => r.key === key);
    expect(release("opentelemetry-specification@v1.20.0")?.commit).toBeUndefined();
    expect(release("semantic-conventions@v1.21.0")?.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(release("semantic-conventions@v1.44.0")).toMatchObject({
      commit: "e10a930844c6951757a43b849d364f7d056ac32b",
      date: "2026-08-04",
      dateBasis: "release-published-at",
      baseline: "semantic-conventions@v1.43.0",
    });
  });

  it("keeps a patch release's baseline on the release it patched", () => {
    const release = (key: string) => data.releases.find((r) => r.key === key);
    expect(release("semantic-conventions@v1.41.1")?.baseline).toBe("semantic-conventions@v1.41.0");
    expect(release("semantic-conventions@v1.42.0")?.baseline).toBe("semantic-conventions@v1.41.0");
  });

  it("covers core through v1.44.0 and GenAI through its first native commit", () => {
    const source = (id: string) => data.sources.find((s) => s.id === id);
    expect(source("semantic-conventions")).toMatchObject({
      mode: "release",
      reviewedThrough: { tag: "v1.44.0", commit: "e10a930844c6951757a43b849d364f7d056ac32b" },
    });
    expect(source("semantic-conventions-genai")).toMatchObject({
      mode: "commit",
      reviewedThrough: { commit: "ebe3d1fb9fdda3398099e11ef91c4c490912f88d" },
    });
    expect(source("opentelemetry-specification")?.mode).toBe("frozen");
  });

  it("gives every event a structured revision instead of a bare release key", () => {
    for (const event of data.events) {
      expect(event).not.toHaveProperty("release");
      expect(event).not.toHaveProperty("commit");
    }
    expect(data).not.toHaveProperty("dates");
    expect(eventNamed("http-baseline").revision).toBe("opentelemetry-specification@v1.20.0");
    expect(eventNamed("process-rc").revision).toBe("semantic-conventions@v1.43.0");
    expect(eventNamed("http-origin").revision).toEqual({
      source: "opentelemetry-specification",
      commit: "4ac49aa1e86633887f49ab1f58221b78b4888e24",
    });
    expect(revisionKey(eventNamed("http-origin").revision)).toBe(
      "opentelemetry-specification@4ac49aa1e86633887f49ab1f58221b78b4888e24"
    );
  });

  it("keeps the GenAI lane continuous across the move", () => {
    const genai = data.lanes.find((lane) => lane.id === "genai")!;
    expect(genai.migration).toEqual({
      eventId: "genai-moved",
      from: "semantic-conventions",
      to: "semantic-conventions-genai",
    });
    expect(data.events.filter((e) => e.lane === "genai").map((e) => e.id)).toContain("genai-moved");
  });

  it("carries evidence inline on the events it supports", () => {
    expect(eventNamed("genai-moved").evidence).toEqual([
      expect.objectContaining({ source: "semantic-conventions" }),
      {
        source: "semantic-conventions-genai",
        namespaces: ["gen-ai", "mcp", "openai"],
        links: [
          "https://github.com/open-telemetry/semantic-conventions-genai/commit/ebe3d1fb9fdda3398099e11ef91c4c490912f88d",
        ],
      },
    ]);
    expect(
      data.events
        .filter((e) => e.evidence)
        .map((e) => e.id)
        .sort()
    ).toEqual(["genai-moved", "http-freeze", "process-attributes-rc", "process-rc"]);
  });

  it("holds no candidate or unreviewed state", () => {
    expect(text).not.toMatch(/unreviewed|reviewStatus/i);
  });
});

describe("validateHistory references", () => {
  const problems = (mutate: (draft: TimelineData) => void) => {
    const draft = clone(data);
    mutate(draft);
    return validateHistory(draft).join("\n");
  };

  it("rejects an unknown schema version", () => {
    expect(problems((d) => (d.schemaVersion = 2))).toContain("schemaVersion");
  });

  it("rejects a release key for an unknown source or one that disagrees with its tag", () => {
    expect(problems((d) => (d.releases[0].key = "nope@v1.0.0"))).toContain(
      "key must be {source}@{tag} for a known source"
    );
    expect(problems((d) => (d.releases[0].tag = "v9.9.9"))).toContain("does not match tag");
  });

  it("rejects duplicate release keys, event IDs and lane IDs", () => {
    const text = problems((d) => {
      d.releases.push({ ...d.releases[0] });
      d.events.push({ ...d.events[0] });
      d.lanes.push({ ...d.lanes[0] });
    });
    expect(text).toContain("duplicate release key");
    expect(text).toContain("duplicate event id");
    expect(text).toContain("duplicate lane id");
  });

  it("rejects malformed immutable revisions", () => {
    const release = (d: TimelineData) =>
      d.releases.find((r) => r.key === "semantic-conventions@v1.44.0")!;
    expect(problems((d) => (release(d).commit = "e10a930"))).toContain("40-character SHA");
    expect(problems((d) => delete release(d).commit)).toContain("requires an immutable commit");
    expect(
      problems((d) => {
        const genai = d.sources.find((s) => s.id === "semantic-conventions-genai")!;
        if (genai.mode !== "frozen") genai.reviewedThrough.commit = "abc";
      })
    ).toContain("reviewedThrough.commit");
  });

  it("rejects a baseline from another source", () => {
    expect(
      problems((d) => {
        d.releases.find((r) => r.key === "semantic-conventions@v1.21.0")!.baseline =
          "opentelemetry-specification@v1.20.0";
      })
    ).toContain("not a release of the same source");
  });

  it("rejects a reviewedThrough tag that does not match a release", () => {
    expect(
      problems((d) => {
        const core = d.sources.find((s) => s.id === "semantic-conventions")!;
        if (core.mode !== "frozen") core.reviewedThrough.tag = "v9.9.9";
      })
    ).toContain("reviewedThrough tag and commit do not match a release");
  });

  it("rejects events whose revision does not resolve", () => {
    expect(problems((d) => (d.events[0].revision = "semantic-conventions@v9.9.9"))).toContain(
      "unknown release"
    );
    expect(
      problems((d) => (d.events[0].revision = { source: "nope", commit: "a".repeat(40) }))
    ).toContain("unknown source nope");
    expect(
      problems(
        (d) => (d.events[0].revision = { source: "semantic-conventions-genai", commit: "x" })
      )
    ).toContain("revision commit must be a 40-character SHA");
  });

  it("validates event and release dateBasis against the supported values", () => {
    const withCommit = (d: TimelineData) => draftEvent(d, "http-origin");
    expect(problems((d) => (d.releases[0].dateBasis = "made-up" as never))).toContain(
      "unknown dateBasis made-up"
    );
    expect(problems((d) => (withCommit(d).dateBasis = "made-up" as never))).toContain(
      "event http-origin: unknown dateBasis made-up"
    );
    expect(problems((d) => delete withCommit(d).dateBasis)).toContain(
      "event http-origin: a commit revision requires a dateBasis"
    );
    expect(
      problems((d) => {
        draftEvent(d, "process-rc").dateBasis = "commit-date";
      })
    ).toContain("event process-rc: a release revision takes its date basis from the release");
  });

  it("accepts a commit-date basis for a commit revision of a source without releases", () => {
    const text = problems((d) => {
      const event = draftEvent(d, "http-origin");
      event.revision = { source: "semantic-conventions-genai", commit: "a".repeat(40) };
      event.dateBasis = "commit-date";
    });
    expect(text).toBe("");
  });

  it("rejects an event date that differs from its release, and invalid dates", () => {
    const withRelease = (d: TimelineData) => d.events.find((e) => typeof e.revision === "string")!;
    expect(problems((d) => (withRelease(d).date = "1999-01-01"))).toContain("differs from");
    expect(problems((d) => (d.events[0].date = "2023-02-30"))).toContain("is not ISO");
  });

  it("accepts every supported event type and rejects any other", () => {
    for (const type of TIMELINE_EVENT_TYPES) {
      expect(problems((d) => (d.events[0].type = type))).toBe("");
    }
    // "stability" is supported; the typo is not.
    expect(problems((d) => (d.events[0].type = "stablity" as never))).toContain(
      `event ${data.events[0].id}: unknown type stablity`
    );
  });

  it("agrees with the generated schema on supported event types", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(dirname(timelinePath), "../../schemas/semantic-conventions-history.schema.json"),
        "utf8"
      )
    );
    expect([...schema.properties.events.items.properties.type.enum].sort()).toEqual(
      [...TIMELINE_EVENT_TYPES].sort()
    );
  });

  it("rejects an unknown lane and a non-https source", () => {
    expect(problems((d) => (d.events[0].lane = "missing"))).toContain("unknown lane missing");
    expect(problems((d) => (d.events[0].source = "http://example.com"))).toContain("https URL");
  });

  it("rejects evidence outside its source's repository or for an unknown source", () => {
    const evidence = (d: TimelineData) => draftEvent(d, "process-rc").evidence![0];
    expect(
      problems((d) => (evidence(d).links = ["https://github.com/open-telemetry/other/pull/1"]))
    ).toContain("not an https URL inside semantic-conventions");
    expect(problems((d) => (evidence(d).source = "nope"))).toContain("unknown source nope");
  });

  it("requires the migration event to be a moved event in the lane", () => {
    expect(
      problems(
        (d) => (d.lanes.find((l) => l.id === "genai")!.migration!.eventId = "genai-introduced")
      )
    ).toContain("must be a moved event");
  });

  it("rejects a namespace claimed by two lanes", () => {
    expect(
      problems((d) => {
        d.lanes[1].namespaces = [...d.lanes[1].namespaces, d.lanes[0].namespaces[0]];
      })
    ).toContain(`namespace ${data.lanes[0].namespaces[0]} is claimed by lanes ${data.lanes[0].id}`);
  });

  it("requires evidence namespaces to belong to the event's lane", () => {
    expect(
      problems((d) => {
        draftEvent(d, "process-rc").evidence![0].namespaces = ["process", "k8s"];
      })
    ).toContain("evidence for process-rc: namespace k8s is not in lane runtime");
    expect(
      problems((d) => {
        draftEvent(d, "process-rc").evidence![0].namespaces = ["process"];
      })
    ).toBe("");
  });

  it("requires lane namespaces to be non-empty", () => {
    expect(problems((d) => (d.lanes[0].namespaces = []))).toContain("namespaces must not be empty");
  });
});

function draftEvent(draft: TimelineData, id: string) {
  return draft.events.find((event) => event.id === id)!;
}

describe("validateHistory on malformed files", () => {
  // Deliberately loose: these tests hand the validator shapes the types forbid.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Loose = Record<string, any>;
  const validate = (mutate: (draft: Loose) => void) => {
    const draft = clone(data) as unknown as Loose;
    mutate(draft);
    return validateHistory(draft);
  };

  it("reports a missing lane namespaces instead of throwing", () => {
    expect(validate((d) => delete d.lanes[0].namespaces)).toEqual([
      "lanes[0].namespaces must be an array of strings",
    ]);
  });

  it("reports mistyped lane, binding and migration shapes", () => {
    const text = validate((d) => {
      d.lanes[1] = "http";
      d.lanes[2].namespaces = "rpc";
      d.lanes[3].migration = { eventId: 7 };
    }).join("\n");
    expect(text).toContain("lanes[1] must be an object");
    expect(text).toContain("lanes[2].namespaces must be an array of strings");
    expect(text).toContain("lanes[3].migration.eventId must be a non-empty string");
    expect(text).toContain("lanes[3].migration.from must be a non-empty string");
  });

  it("reports missing top-level collections and a non-object file", () => {
    expect(validate((d) => delete d.releases)).toContain("releases must be an array");
    expect(validate((d) => delete d.events)).toContain("events must be an array");
    expect(validate((d) => (d.sources = {}))).toContain("sources must be an array");
    expect(validateHistory(null)).toEqual(["timeline.json must be a JSON object"]);
  });

  it("reports malformed sources and releases", () => {
    const text = validate((d) => {
      delete d.sources[0].paths;
      delete d.sources[0].reviewedThrough;
      d.sources[2].mode = "watch";
      delete d.releases[0].tag;
      d.releases[1].date = 20230101;
    }).join("\n");
    expect(text).toContain("sources[0].paths must be an array of strings");
    expect(text).toContain("sources[0].reviewedThrough must be an object");
    expect(text).toContain("sources[2].mode must be one of");
    expect(text).toContain("releases[0].tag must be a non-empty string");
    expect(text).toContain("releases[1].date must be a non-empty string");
  });

  it("reports malformed events, revisions and evidence", () => {
    const text = validate((d) => {
      delete d.events[0].revision;
      d.events[1].revision = { source: "semantic-conventions" };
      d.events[2].major = "yes";
      d.events[3].pullRequest = "82";
      d.events[4].evidence = {};
      d.events[5].evidence = [{ source: "semantic-conventions", namespaces: [], links: [1] }];
      d.events[6].evidence = ["x"];
    }).join("\n");
    expect(text).toContain(
      "events[0].revision must be a release key or a { source, commit } object"
    );
    expect(text).toContain("events[1].revision.commit must be a non-empty string");
    expect(text).toContain("events[2].major must be a boolean");
    expect(text).toContain("events[3].pullRequest must be a number");
    expect(text).toContain("events[4].evidence must be an array");
    expect(text).toContain("events[5].evidence[0].links must be an array of strings");
    expect(text).toContain("events[6].evidence[0] must be an object");
  });

  it("still reports invalid references once the shape is valid", () => {
    expect(validate((d) => (d.events[0].lane = "missing")).join()).toContain(
      "unknown lane missing"
    );
  });

  it("accepts the editor $schema hint and rejects a mistyped one", () => {
    expect(data.$schema).toBeTruthy();
    expect(validate((d) => (d.$schema = 3))).toContain("$schema must be a string");
  });

  it("assertValidHistory throws listing every problem", () => {
    const draft = clone(data);
    draft.schemaVersion = 99;
    expect(() => assertValidHistory(draft)).toThrow(
      /Invalid semantic-convention history[\s\S]*schemaVersion/
    );
  });
});
