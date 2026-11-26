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
import { describe, it, expect } from "vite-plus/test";
import {
  checkCrossReferences,
  parseContribYaml,
  validateContribComponent,
} from "./java-contrib-data";

const VALID_YAML = `
name: span-stacktrace
display_name: Span Stacktrace Capture
description: Adds a \`code.stacktrace\` attribute to qualifying spans.
source_path: span-stacktrace
component_types:
  - library
docs_url: https://github.com/open-telemetry/opentelemetry-java-contrib/blob/main/span-stacktrace/README.md
usage: Include the artifact in application runtime dependencies.
status:
  stability: beta
artifact:
  group_id: io.opentelemetry.contrib
  artifact_id: opentelemetry-span-stacktrace
min_java_version: 8
distributions: []
configurations:
  - type: sdk-autoconfiguration
    display_name: SDK autoconfiguration properties
    description: Set these system properties as JVM arguments.
    example:
      language: shell
      code: |-
        java -Dotel.java.experimental.span-stacktrace.min.duration=10ms -jar app.jar
    settings:
      - name: otel.java.experimental.span-stacktrace.min.duration
        type: duration
        default: "5ms"
        description: Minimum span duration.
      - name: otel.java.experimental.span-stacktrace.filter
        type: string
        default: null
        description: Predicate class name. When unset, all spans are included.
  - type: declarative
    component_key: stacktrace/development
    location: tracer_provider.processors[]
    display_name: Declarative SDK configuration
    description: Add stacktrace/development to tracer_provider.processors.
    example:
      language: yaml
      code: |-
        file_format: '1.0'
        tracer_provider:
          processors:
            - batch: {}
            - stacktrace/development:
                min_duration: 10
    settings:
      - name: min_duration
        type: int
        unit: ms
        default: 5
        description: Minimum span duration in milliseconds.
      - name: filter
        type: string
        default: null
        description: Predicate class name.
`;

type RawConfig = Record<string, unknown> & {
  settings: Record<string, unknown>[];
  example: Record<string, unknown>;
};

function validRaw(): Record<string, unknown> & { configurations: RawConfig[] } {
  const entry = parseContribYaml(VALID_YAML, "span-stacktrace");
  expect(entry.problems).toEqual([]);
  return structuredClone(entry.component) as unknown as Record<string, unknown> & {
    configurations: RawConfig[];
  };
}

function problemsFor(
  mutate: (raw: Record<string, unknown> & { configurations: RawConfig[] }) => void
): string[] {
  const raw = validRaw();
  mutate(raw);
  return validateContribComponent(raw, "span-stacktrace").problems;
}

describe("parseContribYaml", () => {
  it("accepts the reference example with no problems", () => {
    const entry = parseContribYaml(VALID_YAML, "span-stacktrace");
    expect(entry.problems).toEqual([]);
    expect(entry.component.name).toBe("span-stacktrace");
    const [autoconfig, declarative] = entry.component.configurations;
    expect(autoconfig.settings[0].default).toBe("5ms");
    expect(autoconfig.settings[1].default).toBeNull();
    expect(declarative.component_key).toBe("stacktrace/development");
    expect(declarative.location).toBe("tracer_provider.processors[]");
    expect(declarative.settings[0]).toMatchObject({ default: 5, unit: "ms" });
  });

  it("reports YAML syntax errors as problems instead of throwing", () => {
    const entry = parseContribYaml("display_name: [unclosed", "broken");
    expect(entry.problems).toHaveLength(1);
    expect(entry.problems[0]).toMatch(/^YAML parse error/);
    expect(entry.component.display_name).toBe("broken");
    expect(entry.component.configurations).toEqual([]);
  });

  it("rejects duplicate mapping keys", () => {
    const entry = parseContribYaml("name: a\nname: b\n", "a");
    expect(entry.problems[0]).toMatch(/^YAML parse error: duplicated mapping key/);
  });
});

describe("validateContribComponent", () => {
  it("rejects a non-mapping document but still returns a renderable component", () => {
    const { component, problems } = validateContribComponent(["a"], "x");
    expect(problems).toContain("document: must be a YAML mapping");
    expect(component.name).toBe("x");
    expect(component.component_types).toEqual([]);
    expect(component.distributions).toEqual([]);
  });

  it("reports missing and empty required strings", () => {
    const problems = problemsFor((raw) => {
      delete raw.usage;
      raw.description = "  ";
    });
    expect(problems).toContain("usage: required field is missing");
    expect(problems).toContain("description: must be a nonempty string");
  });

  it("rejects unknown fields, including the old component_type name", () => {
    const problems = problemsFor((raw) => {
      raw.component_type = raw.component_types;
      delete raw.component_types;
    });
    expect(problems).toContain("component_type: unknown field");
    expect(problems).toContain("component_types: must be a nonempty list");
  });

  describe("name", () => {
    it("must be a lowercase slug", () => {
      expect(problemsFor((raw) => (raw.name = "Span_Stacktrace"))).toContain(
        'name: "Span_Stacktrace" must match ^[a-z0-9]+(?:-[a-z0-9]+)*$'
      );
    });

    it("must match the file name", () => {
      expect(problemsFor((raw) => (raw.name = "span-stack"))).toContain(
        'name: "span-stack" must match the file name "span-stacktrace.yaml"'
      );
    });
  });

  it("rejects leading or trailing slashes in source_path", () => {
    expect(problemsFor((raw) => (raw.source_path = "/span-stacktrace/"))).toContain(
      "source_path: must not have a leading or trailing slash"
    );
  });

  it("requires an HTTPS docs_url", () => {
    expect(problemsFor((raw) => (raw.docs_url = "http://example.com"))).toContain(
      "docs_url: must be an absolute HTTPS URL"
    );
  });

  it("rejects unknown component types, stabilities and duplicate types", () => {
    const problems = problemsFor((raw) => {
      raw.component_types = ["library", "plugin", "library"];
      raw.status = { stability: "experimental" };
    });
    expect(problems.some((p) => p.startsWith("component_types[1]: must be one of"))).toBe(true);
    expect(problems).toContain('component_types[2]: "library" is listed more than once');
    expect(problems.some((p) => p.startsWith("status.stability: must be one of"))).toBe(true);
  });

  describe("deprecation", () => {
    it("accepts deprecated with or without a replacement", () => {
      expect(problemsFor((raw) => (raw.status = { stability: "deprecated" }))).toEqual([]);
      expect(
        problemsFor((raw) => (raw.status = { stability: "deprecated", replaced_by: "jmx-scraper" }))
      ).toEqual([]);
    });

    it("allows replaced_by only on deprecated components", () => {
      expect(
        problemsFor((raw) => (raw.status = { stability: "beta", replaced_by: "jmx-scraper" }))
      ).toContain("status.replaced_by: only allowed when stability is deprecated");
    });

    it("rejects self-replacement", () => {
      expect(
        problemsFor(
          (raw) => (raw.status = { stability: "deprecated", replaced_by: "span-stacktrace" })
        )
      ).toContain("status.replaced_by: a component cannot replace itself");
    });
  });

  it("requires an integer min_java_version", () => {
    expect(problemsFor((raw) => (raw.min_java_version = "8"))).toContain(
      "min_java_version: must be an integer"
    );
  });

  it("allows artifact to be omitted but validates it when present", () => {
    expect(problemsFor((raw) => delete raw.artifact)).toEqual([]);
    expect(problemsFor((raw) => (raw.artifact = { group_id: "g" }))).toContain(
      "artifact.artifact_id: required field is missing"
    );
  });

  describe("distributions", () => {
    const JAVAAGENT = {
      name: "javaagent",
      repository_url: "https://github.com/open-telemetry/opentelemetry-java-instrumentation",
    };

    it("accepts a known distribution with its repository", () => {
      expect(problemsFor((raw) => (raw.distributions = [JAVAAGENT]))).toEqual([]);
    });

    it("is required, even when empty", () => {
      expect(problemsFor((raw) => delete raw.distributions)).toContain(
        "distributions: must be a list (use [] when none apply)"
      );
    });

    it("rejects unknown names, mismatched repositories and duplicates", () => {
      const problems = problemsFor(
        (raw) =>
          (raw.distributions = [
            { name: "spring-starter", repository_url: "https://github.com/x/y" },
            { name: "javaagent", repository_url: "https://github.com/example/fork" },
            JAVAAGENT,
          ])
      );
      expect(problems).toContain("distributions[0].name: must be one of javaagent");
      expect(problems.some((p) => p.startsWith("distributions[1].repository_url: must be"))).toBe(
        true
      );
      expect(problems).toContain('distributions[2].name: "javaagent" is listed more than once');
    });
  });

  it("requires configurations to be a list, allowing an empty one", () => {
    expect(problemsFor((raw) => (raw.configurations = []))).toEqual([]);
    expect(problemsFor((raw) => delete (raw as Record<string, unknown>).configurations)).toContain(
      "configurations: must be a list (use [] when none apply)"
    );
  });

  it("requires method types to be unique", () => {
    expect(problemsFor((raw) => (raw.configurations[1] = { ...raw.configurations[0] }))).toContain(
      'configurations[1].type: "sdk-autoconfiguration" is listed more than once'
    );
  });

  describe("examples", () => {
    it("restricts the language", () => {
      const problems = problemsFor((raw) => (raw.configurations[0].example.language = "bash"));
      expect(
        problems.some((p) => p.startsWith("configurations[0].example.language: must be one of"))
      ).toBe(true);
    });

    it("requires yaml for declarative examples", () => {
      expect(
        problemsFor((raw) => (raw.configurations[1].example.language = "properties"))
      ).toContain("configurations[1].example.language: declarative examples must use yaml");
    });
  });

  describe("declarative placement", () => {
    it("requires component_key and location together", () => {
      expect(problemsFor((raw) => delete raw.configurations[1].location)).toContain(
        "configurations[1].: component_key and location must be supplied together"
      );
    });

    it("allows omitting both", () => {
      expect(
        problemsFor((raw) => {
          delete raw.configurations[1].location;
          delete raw.configurations[1].component_key;
        })
      ).toEqual([]);
    });

    it("is only allowed on declarative methods", () => {
      expect(
        problemsFor((raw) => {
          raw.configurations[0].component_key = "x";
          raw.configurations[0].location = "y";
        })
      ).toContain(
        "configurations[0].: component_key and location are only allowed on declarative methods"
      );
    });

    it("rejects malformed locations", () => {
      for (const location of ["tracer_provider..processors", "processors[0]", ".a", "a[]b"]) {
        expect(problemsFor((raw) => (raw.configurations[1].location = location))).toContain(
          `configurations[1].location: "${location}" is not a valid path`
        );
      }
    });

    it("requires the example to contain the placement", () => {
      expect(
        problemsFor((raw) => (raw.configurations[1].location = "tracer_provider.processors"))
      ).toContain(
        'configurations[1].example.code: does not contain "stacktrace/development" at "tracer_provider.processors"'
      );
      expect(
        problemsFor((raw) => (raw.configurations[1].component_key = "stacktrace/alpha"))
      ).toContain(
        'configurations[1].example.code: does not contain "stacktrace/alpha" at "tracer_provider.processors[]"'
      );
    });

    it("flags example keys that are not listed settings", () => {
      expect(
        problemsFor((raw) => {
          raw.configurations[1].settings = raw.configurations[1].settings.filter(
            (s) => s.name !== "min_duration"
          );
        })
      ).toContain(
        'configurations[1].example.code: "min_duration" is not a listed setting of this method'
      );
    });
  });

  describe("settings", () => {
    const setting = (raw: { configurations: RawConfig[] }) => raw.configurations[0].settings[0];

    it("flags defaults that do not match the declared type", () => {
      expect(problemsFor((raw) => (setting(raw).default = 5))).toContain(
        'configurations[0].settings[0].default: 5 does not match type "duration"'
      );
    });

    it("accepts double, list and map defaults", () => {
      expect(
        problemsFor((raw) => {
          raw.configurations[0].settings = [
            { name: "a", type: "double", default: 0.5, description: "d" },
            { name: "b", type: "double", default: 2, description: "d" },
            { name: "c", type: "list", default: ["x", "y"], description: "d" },
            { name: "d", type: "list", default: [], description: "d" },
            { name: "e", type: "map", default: { k: "v" }, description: "d" },
          ];
        })
      ).toEqual([]);
    });

    it("rejects non-string list items and map values", () => {
      const problems = problemsFor((raw) => {
        raw.configurations[0].settings = [
          { name: "a", type: "list", default: [1], description: "d" },
          { name: "b", type: "map", default: { k: 1 }, description: "d" },
        ];
      });
      expect(problems).toContain(
        'configurations[0].settings[0].default: [1] does not match type "list"'
      );
      expect(problems).toContain(
        'configurations[0].settings[1].default: {"k":1} does not match type "map"'
      );
    });

    it("requires default to be present, even when null", () => {
      expect(problemsFor((raw) => delete raw.configurations[0].settings[1].default)).toContain(
        "configurations[0].settings[1].default: required field is missing (use null for no value)"
      );
    });

    it("flags duplicate setting names within a method", () => {
      const problems = problemsFor((raw) => {
        const [first, second] = raw.configurations[0].settings;
        second.name = first.name;
      });
      expect(problems).toContain(
        'configurations[0].settings[1].name: "otel.java.experimental.span-stacktrace.min.duration" is not unique in this method'
      );
    });

    it("validates allowed_values and default membership", () => {
      const withAllowed = (allowed: unknown, def: unknown = null) =>
        problemsFor((raw) => {
          raw.configurations[0].settings[1].allowed_values = allowed;
          raw.configurations[0].settings[1].default = def;
        });
      expect(withAllowed(["a", "b"], "a")).toEqual([]);
      expect(withAllowed(["a", "b"], "c")).toContain(
        'configurations[0].settings[1].default: "c" is not one of allowed_values'
      );
      expect(withAllowed(["a", "a"])).toContain(
        "configurations[0].settings[1].allowed_values: values must be distinct"
      );
      expect(withAllowed([])).toContain(
        "configurations[0].settings[1].allowed_values: must be a nonempty list of nonempty strings"
      );
      expect(problemsFor((raw) => (setting(raw).allowed_values = ["5ms"]))).toContain(
        "configurations[0].settings[0].allowed_values: only allowed on string settings"
      );
    });

    it("allows unit only on int and double settings", () => {
      expect(problemsFor((raw) => (setting(raw).unit = "ms"))).toContain(
        "configurations[0].settings[0].unit: only allowed on int and double settings"
      );
    });
  });
});

describe("checkCrossReferences", () => {
  const deprecated = parseContribYaml(
    VALID_YAML.replace("stability: beta", "stability: deprecated\n  replaced_by: jmx-scraper"),
    "span-stacktrace"
  );

  it("accepts a replacement that has metadata", () => {
    const entry = checkCrossReferences(deprecated, {
      components: ["span-stacktrace", "jmx-scraper"],
    });
    expect(entry.problems).toEqual([]);
  });

  it("flags a replacement with no metadata", () => {
    const entry = checkCrossReferences(deprecated, { components: ["span-stacktrace"] });
    expect(entry.problems).toEqual(['status.replaced_by: no component named "jmx-scraper" exists']);
  });
});
