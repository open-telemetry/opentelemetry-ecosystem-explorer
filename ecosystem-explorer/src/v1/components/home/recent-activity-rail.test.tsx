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
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentActivityRail } from "./recent-activity-rail";

const SAMPLE_FEED = {
  generatedAt: "2026-05-13T00:00:00Z",
  items: [
    {
      id: "kafka",
      title: "Kafka Receiver promoted to beta",
      stability: "beta",
      ecosystem: "collector",
      version: "v0.150.0",
      occurredAt: "2026-05-11T00:00:00Z",
      href: "/collector/components",
    },
    {
      id: "splunk",
      title: "Splunk HEC Exporter added",
      stability: "stable",
      ecosystem: "collector-contrib",
      version: "v0.150.0",
      occurredAt: "2026-05-09T00:00:00Z",
      href: "/collector/components",
    },
  ],
};

function renderRail(props: Parameters<typeof RecentActivityRail>[0] = {}) {
  return render(
    <MemoryRouter>
      <RecentActivityRail {...props} />
    </MemoryRouter>
  );
}

describe("RecentActivityRail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading state while the feed is in-flight", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );
    renderRail();
    expect(screen.getByText(/Loading recent activity/i)).toBeInTheDocument();
  });

  it("renders feed items once loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_FEED,
      })
    );

    renderRail();

    await waitFor(() =>
      expect(screen.getByText(/Kafka Receiver promoted to beta/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Splunk HEC Exporter added/i)).toBeInTheDocument();
  });

  it("renders an error state when the feed responds with a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    );

    renderRail();

    await waitFor(() =>
      expect(screen.getByText(/We couldn't load the activity feed/i)).toBeInTheDocument()
    );
  });
});
