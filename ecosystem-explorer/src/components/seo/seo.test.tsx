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

import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Seo } from "./seo";
import { DEFAULT_TITLE, SITE_ORIGIN } from "@/lib/seo/constants";
import { STATIC_ROUTE_META } from "@/lib/seo/derive";

const metaContent = (attr: "name" | "property", key: string) =>
  document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content");

const renderAt = (path: string, props: Parameters<typeof Seo>[0] = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Seo {...props} />
    </MemoryRouter>
  );

afterEach(() => {
  document.head.innerHTML = "";
  document.title = "";
});

describe("Seo", () => {
  it("resolves title/description from the static route map by pathname", () => {
    renderAt("/collector");
    const expected = STATIC_ROUTE_META["/collector"];
    expect(document.title).toBe(expected.title);
    expect(metaContent("name", "description")).toBe(expected.description);
    expect(metaContent("property", "og:title")).toBe(expected.title);
    expect(metaContent("property", "og:description")).toBe(expected.description);
  });

  it("prefers explicit props over the static map (detail-page usage)", () => {
    renderAt("/collector/components/contrib/kafkareceiver", {
      title: "Kafka Receiver — OpenTelemetry Collector",
      description: "Receives Kafka data.",
    });
    expect(document.title).toBe("Kafka Receiver — OpenTelemetry Collector");
    expect(metaContent("name", "description")).toBe("Receives Kafka data.");
  });

  it("sets a query-less canonical URL from the current pathname", () => {
    renderAt("/java-agent/instrumentation/kafka-clients-0.11?version=2.29.0", {
      title: "t",
      description: "d",
    });
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE_ORIGIN}/java-agent/instrumentation/kafka-clients-0.11`
    );
  });

  it("falls back to site defaults for an unknown route with no props", () => {
    renderAt("/some/unknown/path");
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(metaContent("name", "description")?.length).toBeGreaterThan(0);
  });

  it("updates the existing static tag in place instead of duplicating it", () => {
    const staticMeta = document.createElement("meta");
    staticMeta.setAttribute("name", "description");
    staticMeta.setAttribute("content", "original");
    document.head.appendChild(staticMeta);

    renderAt("/collector");

    const all = document.head.querySelectorAll('meta[name="description"]');
    expect(all.length).toBe(1);
    expect(all[0].getAttribute("content")).toBe(STATIC_ROUTE_META["/collector"].description);
  });
});
