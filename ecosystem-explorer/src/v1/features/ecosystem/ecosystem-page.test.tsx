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
import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  useEcosystemLandingData.mockReset();
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

    // Static fallback values from configs.tsx.
    expect(screen.getByText("v0.150.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Receivers — 98 components$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Processors — 28 components$/ })).toBeInTheDocument();
  });

  it("renders breadcrumbs Explorer › Ecosystems › Collector", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<CollectorLandingV1 />);
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toHaveTextContent(/Explorer/);
    expect(nav).toHaveTextContent(/Ecosystems/);
    expect(nav).toHaveTextContent(/OpenTelemetry Collector/);
  });

  it("renders the three quick-entry cards", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<CollectorLandingV1 />);
    expect(screen.getByRole("heading", { name: /Most-used components/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Core vs\. Contrib/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Diff across versions/i })).toBeInTheDocument();
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
  });

  it("falls back to static category counts and version on error", () => {
    useEcosystemLandingData.mockReturnValue(errorState);
    renderRouter(<JavaAgentLandingV1 />);
    expect(screen.getByText("v2.10.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^HTTP — 32 components$/ })).toBeInTheDocument();
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
