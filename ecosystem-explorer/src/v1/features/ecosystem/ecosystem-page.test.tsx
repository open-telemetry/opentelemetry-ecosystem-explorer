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
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { Announcement } from "@/features/java-agent/hooks/use-java-agent-announcements";
import type { DataState } from "@/hooks/data-state";
import { CollectorLandingV1 } from "./collector-landing";
import { JavaAgentLandingV1 } from "./java-agent-landing";
import type { EcosystemLandingData } from "./use-ecosystem-landing-data";

// Mock the data hook so the page renders deterministically without the data
// layer (loading / success / error states are driven by the mock return).
const useEcosystemLandingData = vi.fn<() => DataState<EcosystemLandingData>>();
vi.mock("./use-ecosystem-landing-data", () => ({
  useEcosystemLandingData: () => useEcosystemLandingData(),
}));

// Mock the announcements feed too, so no landing test depends on a network fetch.
const useJavaAgentAnnouncements = vi.fn<() => DataState<Announcement[]>>();
vi.mock("@/features/java-agent/hooks/use-java-agent-announcements", () => ({
  useJavaAgentAnnouncements: () => useJavaAgentAnnouncements(),
}));

function renderRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

function success(data: EcosystemLandingData): DataState<EcosystemLandingData> {
  return { data, loading: false, error: null };
}

const loadingState: DataState<EcosystemLandingData> = { data: null, loading: true, error: null };
const errorState: DataState<EcosystemLandingData> = {
  data: null,
  loading: false,
  error: new Error("boom"),
};

const announcement: Announcement = {
  id: "welcome",
  date: "2026-09-12",
  title: "Welcome to the Java Agent Explorer",
  body: "Announcements are now shown on the landing page.",
};

beforeEach(() => {
  // No announcements unless a test opts in.
  useJavaAgentAnnouncements.mockReturnValue({ data: [], loading: false, error: null });
});

afterEach(() => {
  useEcosystemLandingData.mockReset();
  useJavaAgentAnnouncements.mockReset();
});

describe("Collector ecosystem landing", () => {
  it("renders live stage counts and release version on success", () => {
    useEcosystemLandingData.mockReturnValue(
      success({
        stageCounts: { receiver: 116, processor: 37, exporter: 52, connector: 16, extension: 47 },
        release: { version: "v0.154.0", deltas: { added: 1, changed: 7, deprecated: 4 } },
      })
    );
    renderRouter(<CollectorLandingV1 />);

    // Copy is resolved from the `collector` namespace, not a literal string.
    expect(
      screen.getByText(i18n.t("landingV1.hero.eyebrow", { ns: "collector" }))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /OpenTelemetry Collector/i })
    ).toBeInTheDocument();
    expect(screen.getByText("v0.154.0")).toBeInTheDocument();
    // Collector has live deltas, so the change strip is present.
    expect(screen.getByRole("list", { name: "Changes in this release" })).toBeInTheDocument();

    // Live counts flow into each stage's deep-link aria-label.
    expect(screen.getByRole("link", { name: /^Receivers — 116 components$/ })).toHaveAttribute(
      "href",
      "/collector/components?type=receiver"
    );
    expect(screen.getByRole("link", { name: /^Exporters — 52 components$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Extensions — 47 components$/ })).toBeInTheDocument();
  });

  it("shows a loading skeleton while data is in flight", () => {
    useEcosystemLandingData.mockReturnValue(loadingState);
    renderRouter(<CollectorLandingV1 />);

    // Pipeline is replaced by the loading placeholder; no stage links yet.
    expect(screen.queryByRole("link", { name: /— \d+ components$/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Pipeline anatomy loading/i)).toBeInTheDocument();
  });

  it("falls back to the static config counts and version on error", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<CollectorLandingV1 />);

    // Static fallback values from collector-config.tsx.
    expect(screen.getByText("v0.150.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Receivers — 98 components$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Processors — 28 components$/ })).toBeInTheDocument();
  });

  it("keeps the static lead when a total is present but the config has no total lead", () => {
    useEcosystemLandingData.mockReturnValue(
      success({
        stageCounts: { receiver: 116 },
        total: 268,
        release: { version: "v0.154.0", deltas: null },
      })
    );
    renderRouter(<CollectorLandingV1 />);

    expect(
      screen.getByText(i18n.t("landingV1.pipeline.lead", { ns: "collector" }))
    ).toBeInTheDocument();
    expect(screen.queryByText(/WithTotal/)).not.toBeInTheDocument();
  });

  it("renders breadcrumbs Explorer › Ecosystems › Collector", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<CollectorLandingV1 />);
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toHaveTextContent(/Explorer/);
    expect(nav).toHaveTextContent(/Ecosystems/);
    expect(nav).toHaveTextContent(/OpenTelemetry Collector/);
  });

  it("renders the existing quick entries plus deprecated components", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<CollectorLandingV1 />);
    expect(screen.getByRole("heading", { name: /Most-used components/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Core vs\. Contrib/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Diff across versions/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Deprecated components/i })).toHaveAttribute(
      "href",
      "/collector/components?version=deprecated"
    );
  });
});

describe("Java Agent ecosystem landing", () => {
  it("renders live category counts and version-only release on success", () => {
    useEcosystemLandingData.mockReturnValue(
      success({
        stageCounts: { http: 92, db: 13, messaging: 24, frameworks: 7, runtime: 3 },
        release: { version: "v2.28.1", deltas: null },
      })
    );
    renderRouter(<JavaAgentLandingV1 />);

    expect(screen.getByRole("link", { name: /^HTTP — 92 components$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Databases — 13 components$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Frameworks — 7 components$/ })).toBeInTheDocument();
    expect(screen.getByText("v2.28.1")).toBeInTheDocument();
    // Version-only: Java Agent has no stability data, so there is no delta strip.
    expect(screen.queryByRole("list", { name: "Changes in this release" })).not.toBeInTheDocument();
  });

  it("falls back to static category counts and version on error", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<JavaAgentLandingV1 />);
    expect(screen.getByText("v2.10.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^HTTP — 32 components$/ })).toBeInTheDocument();
    // The static fallback is version-only too — never a fabricated delta strip.
    expect(screen.queryByRole("list", { name: "Changes in this release" })).not.toBeInTheDocument();
    // No live total on the fallback path, so the static lead renders with no number.
    expect(
      screen.getByText(/^Java auto-instrumentations are grouped by category\./)
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Browse \d+ Java auto-instrumentation/)).not.toBeInTheDocument();
  });

  it("shows the live total instrumentation count in the categories lead", () => {
    useEcosystemLandingData.mockReturnValue(
      success({
        stageCounts: { http: 92, db: 13, messaging: 24, frameworks: 7, runtime: 3 },
        total: 256,
        release: { version: "v2.28.1", deltas: null },
      })
    );
    renderRouter(<JavaAgentLandingV1 />);
    expect(
      screen.getByText(/^Browse 256 Java auto-instrumentations by category\./)
    ).toBeInTheDocument();
  });

  it("uses the singular lead when there is exactly one instrumentation", () => {
    useEcosystemLandingData.mockReturnValue(
      success({
        stageCounts: { http: 1 },
        total: 1,
        release: { version: "v2.28.1", deltas: null },
      })
    );
    renderRouter(<JavaAgentLandingV1 />);
    expect(
      screen.getByText(/^Browse 1 Java auto-instrumentation by category\./)
    ).toBeInTheDocument();
  });

  it("renders the six quick entries, with the docs links opening in a new tab", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<JavaAgentLandingV1 />);

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent)
      .filter((text) =>
        [
          "Configuration builder",
          "Compare releases",
          "Supported libraries",
          "Configuration options",
          "Getting started",
          "Configuration reference",
        ].includes(text ?? "")
      );
    expect(titles).toHaveLength(6);

    // Configuration options is an in-app link: no new tab.
    const configuration = screen.getByRole("link", { name: /Configuration options/i });
    expect(configuration).toHaveAttribute("href", "/java-agent/configuration");
    expect(configuration).not.toHaveAttribute("target");

    const gettingStarted = screen.getByRole("link", { name: /Getting started/i });
    expect(gettingStarted).toHaveAttribute("href", "https://opentelemetry.io/docs/zero-code/java/");
    expect(gettingStarted).toHaveAttribute("target", "_blank");
    expect(gettingStarted).toHaveAttribute("rel", expect.stringContaining("noopener"));

    const reference = screen.getByRole("link", { name: /Configuration reference/i });
    expect(reference).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/zero-code/java/agent/configuration/"
    );
    expect(reference).toHaveAttribute("target", "_blank");
    expect(reference).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

describe("Ecosystem landing announcements", () => {
  it("shows the Java Agent news band between the hero and the categories", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    useJavaAgentAnnouncements.mockReturnValue({
      data: [announcement],
      loading: false,
      error: null,
    });
    renderRouter(<JavaAgentLandingV1 />);

    const news = screen.getByRole("heading", { level: 2, name: "News & Announcements" });
    expect(screen.getByRole("heading", { level: 3, name: announcement.title })).toBeInTheDocument();

    const hero = screen.getByRole("heading", { level: 1, name: /OpenTelemetry Java Agent/i });
    const categories = screen.getByRole("heading", { name: "Instrumentation categories" });
    expect(hero.compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      news.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("leaves the Java Agent page unchanged when there are no announcements", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<JavaAgentLandingV1 />);

    expect(screen.queryByRole("heading", { name: "News & Announcements" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Instrumentation categories" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quick entries" })).toBeInTheDocument();
  });

  it("does not show or fetch announcements on the Collector landing", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    useJavaAgentAnnouncements.mockReturnValue({
      data: [announcement],
      loading: false,
      error: null,
    });
    renderRouter(<CollectorLandingV1 />);

    expect(screen.queryByRole("heading", { name: "News & Announcements" })).not.toBeInTheDocument();
    expect(screen.queryByText(announcement.title)).not.toBeInTheDocument();
    // Collector never opts in, so the Java Agent feed is not even requested.
    expect(useJavaAgentAnnouncements).not.toHaveBeenCalled();
  });
});

describe("Ecosystem landing i18n", () => {
  // Proves the per-ecosystem copy is namespace-resolved, not hardcoded: render
  // in Spanish and assert the translated hero lead appears.
  it("renders the Spanish lead when the language is switched", async () => {
    const javaAgentEs = await import("../../../../public/locales/es/java-agent.json");
    i18n.addResourceBundle("es", "java-agent", javaAgentEs.default, true, true);
    await i18n.changeLanguage("es");

    try {
      useEcosystemLandingData.mockReturnValue(errorState);
      renderRouter(<JavaAgentLandingV1 />);
      expect(
        screen.getByText(i18n.t("landingV1.hero.lead", { ns: "java-agent" }))
      ).toBeInTheDocument();
      expect(screen.getByText(/Auto-instrumentación · JVM/)).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage("en");
    }
  });
});

describe("Ecosystem landing hero CTAs", () => {
  it("sizes every hero CTA like upstream's .btn-lg", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    const { container } = renderRouter(<CollectorLandingV1 />);
    const ctas = container.querySelectorAll(".td-cover-block .td-btn");
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta).toHaveClass("td-btn--lg");
  });
});
