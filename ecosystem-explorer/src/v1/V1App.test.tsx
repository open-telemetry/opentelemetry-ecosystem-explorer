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
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { V1App } from "@/v1/V1App";
import { ThemeProvider } from "@/theme-context";
import {
  useCollectorComponent,
  useCollectorComponents,
  useCollectorDeprecations,
  useCollectorVersions,
  useComponentVersions,
} from "@/hooks/use-collector-data";
import type { CollectorComponent, DeprecatedIndexComponent } from "@/types/collector";

vi.mock("@/hooks/use-collector-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-collector-data")>()),
  useCollectorComponent: vi.fn(),
  useCollectorComponents: vi.fn(),
  useCollectorDeprecations: vi.fn(),
  useCollectorVersions: vi.fn(),
  useComponentVersions: vi.fn(),
}));

const receiver: CollectorComponent = {
  id: "core-otlpreceiver",
  name: "otlpreceiver",
  display_name: "OTLP Receiver",
  distribution: "core",
  ecosystem: "collector",
  type: "receiver",
  repository: "opentelemetry-collector",
};
const deprecatedReceiver: DeprecatedIndexComponent = {
  id: "contrib-jmxreceiver",
  name: "jmxreceiver",
  display_name: "JMX Receiver",
  distribution: "contrib",
  type: "receiver",
  component_hash: "abc123def456",
  last_version: "0.149.0",
  deprecated_in_version: "0.150.0",
};

function NavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="location">{location.pathname + location.search + location.hash}</div>
      <button onClick={() => navigate(-1)}>Test back</button>
      <button onClick={() => navigate(1)}>Test forward</button>
    </>
  );
}

function renderCollectorRoute(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/about", path]}>
        <V1App />
        <NavigationProbe />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("V1App", () => {
  it("renders the v1 navbar", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <V1App />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(await screen.findByLabelText("OpenTelemetry")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("wraps content in a .v1-app scoping container", () => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <V1App />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(container.querySelector(".v1-app")).not.toBeNull();
  });
});

describe("Collector release navigation through V1App routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: {
        versions: [
          { version: "0.150.0", is_latest: true },
          { version: "0.149.0", is_latest: false },
        ],
      },
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: [receiver],
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponent).mockImplementation((distribution, name, version) => ({
      data: {
        ...receiver,
        distribution,
        name,
        display_name: name === "jmxreceiver" ? "JMX Receiver" : "OTLP Receiver",
        description: `Snapshot ${version}`,
      },
      loading: false,
      error: null,
    }));
    vi.mocked(useCollectorDeprecations).mockReturnValue({
      data: { ecosystem: "collector", components: [deprecatedReceiver] },
      loading: false,
      error: null,
    });
    vi.mocked(useComponentVersions).mockReturnValue({
      data: ["0.150.0", "0.149.0"],
      loading: false,
      error: null,
    });
  });

  it.each([
    "/collector/components/0.149.0?type=receiver&q=OTLP&density=table",
    "/collector/components?version=0.149.0&type=receiver&q=OTLP&density=table",
    "/collector/components/0.150.0?version=0.149.0&type=receiver&q=OTLP&density=table",
    "/collector/components/0.149.0?version=&type=receiver&q=OTLP&density=table",
  ])("preserves release and filters from %s through row, detail, source and Back", async (path) => {
    const user = userEvent.setup();
    renderCollectorRoute(path);
    const row = await screen.findByRole("link", { name: /OTLP Receiver/ });
    const listLocation = screen.getByTestId("location").textContent!;
    const canonical = new URL(listLocation, "https://example.test");
    expect(canonical.pathname).toBe("/collector/components");
    expect(canonical.searchParams.get("version")).toBe("0.149.0");
    expect(canonical.searchParams.get("type")).toBe("receiver");
    expect(canonical.searchParams.get("q")).toBe("OTLP");
    expect(canonical.searchParams.get("density")).toBe("table");
    expect(row).toHaveAttribute("href", "/collector/components/core/otlpreceiver?version=0.149.0");
    await user.click(row);
    expect(await screen.findByRole("heading", { name: "OTLP Receiver" })).toBeInTheDocument();
    expect(screen.getByText("Snapshot 0.149.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-collector/tree/v0.149.0/receiver/otlpreceiver"
    );
    await user.click(screen.getByRole("button", { name: "Test back" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(listLocation));
    await user.click(screen.getByRole("button", { name: "Test back" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/about"));
    await user.click(screen.getByRole("button", { name: "Test forward" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(listLocation));
  });

  it.each(["/collector/components", "/collector/components?version="])(
    "keeps the implicit latest view at main from %s",
    async (path) => {
      const user = userEvent.setup();
      renderCollectorRoute(path);
      const row = await screen.findByRole("link", { name: /OTLP Receiver/ });
      expect(row).toHaveAttribute("href", "/collector/components/core/otlpreceiver");
      await user.click(row);
      expect(await screen.findByText("Snapshot 0.150.0")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
        "href",
        "https://github.com/open-telemetry/opentelemetry-collector/tree/main/receiver/otlpreceiver"
      );
    }
  );

  it.each(["/collector/components/deprecated", "/collector/components?version=deprecated"])(
    "keeps deprecated last-release semantics from %s",
    async (path) => {
      const user = userEvent.setup();
      renderCollectorRoute(path);
      const row = await screen.findByRole("link", { name: /JMX Receiver/ });
      expect(row).toHaveAttribute(
        "href",
        "/collector/components/contrib/jmxreceiver?version=deprecated"
      );
      await user.click(row);
      expect(await screen.findByText("Snapshot 0.149.0")).toBeInTheDocument();
      expect(screen.getByRole("note")).toHaveTextContent(/0\.149\.0.*0\.150\.0/);
      expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
        "href",
        "https://github.com/open-telemetry/opentelemetry-collector/tree/v0.149.0/receiver/jmxreceiver"
      );
    }
  );
});
