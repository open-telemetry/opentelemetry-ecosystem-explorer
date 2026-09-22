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

import { describe, expect, it } from "vitest";
import type { CollectorComponent } from "@/types/collector";
import { collectorReleaseContext } from "@/v1/lib/collector-release";

const component = {
  distribution: "core",
  name: "forwardconnector",
  type: "connector",
  repository: "opentelemetry-collector",
} satisfies Pick<CollectorComponent, "distribution" | "name" | "type" | "repository">;
const versions = { versions: [{ version: "0.150.0", is_latest: true }] };

describe("Collector release context", () => {
  it.each([
    ["version=0.148.0", "0.149.0", "0.148.0"],
    ["version=+0.148.0+", "0.149.0", "0.148.0"],
    ["version=+v0.148.0+", "v0.149.0", "0.148.0"],
    ["", " v0.149.0 ", "0.149.0"],
    ["version=+%09+", "0.149.0", "0.149.0"],
    ["version=+%09+", undefined, "0.150.0"],
    ["version=", "0.149.0", "0.149.0"],
    ["", "0.149.0", "0.149.0"],
    ["", undefined, "0.150.0"],
  ])("resolves %s with path %s to %s", (query, pathVersion, expected) => {
    const release = collectorReleaseContext({
      searchParams: new URLSearchParams(query),
      pathVersion,
      versions,
    });
    expect(release.dataVersion()).toBe(expected);
  });

  it("canonicalizes only the release while preserving repeated filters and the input", () => {
    const searchParams = new URLSearchParams(
      "type=receiver&type=processor&q=OTLP+receiver&density=cards&page=2&version="
    );
    const release = collectorReleaseContext({ searchParams, pathVersion: "0.149.0" });
    expect(release.listHref).toBe(
      "/collector/components?type=receiver&type=processor&q=OTLP+receiver&density=cards&page=2&version=0.149.0"
    );
    expect(searchParams.get("version")).toBe("");
  });

  it.each([
    [" 0.149.0 ", "0.149.0", "?version=0.149.0", "v0.149.0"],
    [" \t ", "0.150.0", "", "main"],
  ])("keeps normalized data and links consistent for %j", (version, dataVersion, suffix, ref) => {
    const searchParams = new URLSearchParams("type=receiver&type=processor&q=OTLP+receiver");
    searchParams.set("version", version);
    const original = searchParams.toString();
    const release = collectorReleaseContext({ searchParams, versions });
    expect(release.dataVersion()).toBe(dataVersion);
    expect(release.detailHref(component)).toBe(
      `/collector/components/core/forwardconnector${suffix}`
    );
    expect(release.listHref).toBe(
      `/collector/components?type=receiver&type=processor&q=OTLP+receiver${suffix.replace("?", "&")}`
    );
    expect(release.sourceHref(component)).toContain(`/tree/${ref}/`);
    expect(searchParams.toString()).toBe(original);
  });

  it.each(["0.149.0", "v0.149.0"])(
    "normalizes %s to a bare data version with a tagged source ref",
    (version) => {
      const release = collectorReleaseContext({ searchParams: new URLSearchParams({ version }) });
      // Data manifests use bare versions; source tags retain exactly one prefix.
      expect(release.sourceHref(component)).toContain("/tree/v0.149.0/");
      expect(release.dataVersion()).toBe("0.149.0");
      expect(release.detailHref(component)).toContain("?version=0.149.0");

      const deprecated = collectorReleaseContext({
        searchParams: new URLSearchParams("version=deprecated"),
      });
      expect(deprecated.sourceHref(component, version)).toContain("/tree/v0.149.0/");
      expect(deprecated.dataVersion(version)).toBe(version);
    }
  );

  it("keeps implicit latest links bare and source on main, including before versions load", () => {
    const release = collectorReleaseContext({ searchParams: new URLSearchParams() });
    expect(release.dataVersion()).toBe("");
    expect(release.detailHref(component)).toBe("/collector/components/core/forwardconnector");
    expect(release.sourceHref(component)).toContain("/tree/main/");
  });

  it("pins an explicit release even when it is currently the newest", () => {
    const release = collectorReleaseContext({
      searchParams: new URLSearchParams("version=0.150.0"),
      versions,
    });
    expect(release.detailHref(component)).toBe(
      "/collector/components/core/forwardconnector?version=0.150.0"
    );
    expect(release.sourceHref(component)).toContain("/tree/v0.150.0/");
    expect(release.detailHref(component, "0.149.0")).toBe(
      "/collector/components/core/forwardconnector?version=0.149.0"
    );
    expect(release.detailHref(component, " v0.149.0 ")).toBe(
      "/collector/components/core/forwardconnector?version=0.149.0"
    );
  });

  it.each(["deprecated", " deprecated "])(
    "retains %j navigation but resolves each component to its own last release",
    (version) => {
      const release = collectorReleaseContext({
        searchParams: new URLSearchParams({ version }),
        versions,
      });
      expect(release.deprecated).toBe(true);
      expect(release.listHref).toBe("/collector/components?version=deprecated");
      expect(release.detailHref(component)).toContain("?version=deprecated");
      expect(release.dataVersion()).toBe("");
      expect(release.sourceHref(component)).toBeNull();
      expect(release.dataVersion("0.140.0")).toBe("0.140.0");
      expect(release.sourceHref(component, "0.140.0")).toContain("/tree/v0.140.0/");
      expect(release.dataVersion("0.149.0")).toBe("0.149.0");
      expect(release.sourceHref(component, "0.149.0")).toContain("/tree/v0.149.0/");
    }
  );

  it("does not invent a source for a component with no repository", () => {
    const release = collectorReleaseContext({
      searchParams: new URLSearchParams("version=0.149.0"),
    });
    expect(release.sourceHref({ ...component, repository: undefined })).toBeNull();
  });
});
