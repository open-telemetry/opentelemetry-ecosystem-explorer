import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { JavaInstrumentationListPage } from "./java-instrumentation-list-page";
import type { InstrumentationData } from "@/types/javaagent";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: vi.fn(),
  useInstrumentations: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

import { useVersions, useInstrumentations } from "@/hooks/use-javaagent-data";

function renderPage() {
  return render(
    <BrowserRouter>
      <JavaInstrumentationListPage />
    </BrowserRouter>
  );
}

describe("JavaInstrumentationListPage - Filtering", () => {
  const mockInstrumentations: InstrumentationData[] = [
    {
      name: "http-client",
      display_name: "HTTP Client",
      description: "Instrumentation for HTTP clients",
      scope: { name: "http" },
      javaagent_target_versions: ["1.0.0"],
      telemetry: [{ when: "always", spans: [{ span_kind: "CLIENT" }] }],
    },
    {
      name: "jdbc",
      display_name: "JDBC",
      description: "Database instrumentation for JDBC",
      scope: { name: "jdbc" },
      has_standalone_library: true,
      telemetry: [
        {
          when: "always",
          metrics: [
            {
              name: "db.connections",
              description: "DB connections",
              type: "GAUGE",
              unit: "1",
            },
          ],
        },
      ],
    },
    {
      name: "kafka-client",
      display_name: "Kafka Client",
      description: "Messaging instrumentation for Kafka",
      scope: { name: "kafka" },
      javaagent_target_versions: ["1.0.0"],
      has_standalone_library: true,
      telemetry: [
        {
          when: "always",
          spans: [{ span_kind: "PRODUCER" }],
          metrics: [
            {
              name: "kafka.messages",
              description: "Messages sent",
              type: "COUNTER",
              unit: "1",
            },
          ],
        },
      ],
    },
    {
      name: "spring-web",
      display_name: "Spring Web",
      description: "Instrumentation for Spring Web applications",
      scope: { name: "spring" },
      javaagent_target_versions: ["1.0.0"],
    },
  ];

  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue({
      data: {
        versions: [{ version: "2.0.0", is_latest: true }],
      },
      loading: false,
      error: null,
    });

    vi.mocked(useInstrumentations).mockReturnValue({
      data: mockInstrumentations,
      loading: false,
      error: null,
    });
  });

  it("displays all instrumentations initially", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("HTTP Client")).toBeInTheDocument();
      expect(screen.getByText("JDBC")).toBeInTheDocument();
      expect(screen.getByText("Kafka Client")).toBeInTheDocument();
      expect(screen.getByText("Spring Web")).toBeInTheDocument();
    });

    expect(screen.getByText("Showing 4 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters instrumentations by search term in name", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "kafka");

    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters instrumentations by search term in description", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "database");

    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("search is case insensitive", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "KAFKA");

    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by spans telemetry", async () => {
    const user = userEvent.setup();
    renderPage();

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    await user.click(spansButton);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by metrics telemetry", async () => {
    const user = userEvent.setup();
    renderPage();

    const metricsButton = await screen.findByRole("button", { name: "Metrics" });
    await user.click(metricsButton);

    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by both spans and metrics (AND logic)", async () => {
    const user = userEvent.setup();
    renderPage();

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    const metricsButton = await screen.findByRole("button", { name: "Metrics" });

    await user.click(spansButton);
    await user.click(metricsButton);

    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by javaagent target type", async () => {
    const user = userEvent.setup();
    renderPage();

    const javaAgentButton = await screen.findByRole("button", { name: "Java Agent" });
    await user.click(javaAgentButton);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.getByText("Spring Web")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by library target type", async () => {
    const user = userEvent.setup();
    renderPage();

    const libraryButton = await screen.findByRole("button", { name: "Standalone" });
    await user.click(libraryButton);

    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("combines multiple filters (search + telemetry + target)", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "client");

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    await user.click(spansButton);

    const javaAgentButton = await screen.findByRole("button", { name: "Java Agent" });
    await user.click(javaAgentButton);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("shows empty state when no instrumentations match filters", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "nonexistent");

    expect(
      screen.getByText("No instrumentations found matching your filters.")
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 4 instrumentations")).toBeInTheDocument();
  });

  it("shows loading state while fetching data", () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Loading instrumentations...")).toBeInTheDocument();
  });

  it("shows error state when data fetch fails", () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load instrumentations"),
    });

    renderPage();

    expect(screen.getByText("Error loading instrumentations")).toBeInTheDocument();
    expect(screen.getByText("Failed to load instrumentations")).toBeInTheDocument();
  });
});
