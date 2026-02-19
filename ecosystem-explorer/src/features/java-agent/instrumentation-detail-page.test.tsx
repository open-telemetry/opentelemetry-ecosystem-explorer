import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InstrumentationDetailPage } from "./instrumentation-detail-page";
import type { InstrumentationData } from "@/types/javaagent";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: vi.fn(),
  useInstrumentation: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

import { useVersions, useInstrumentation } from "@/hooks/use-javaagent-data";

const mockVersionsData = {
  versions: [
    { version: "2.0.0", is_latest: true },
    { version: "1.9.0", is_latest: false },
  ],
};

const mockInstrumentation: InstrumentationData = {
  name: "jdbc",
  display_name: "JDBC",
  description: "Instrumentation for JDBC database connections",
  scope: { name: "jdbc" },
  library_link: "https://example.com/jdbc",
  source_path: "https://github.com/example/jdbc",
  javaagent_target_versions: ["1.0.0", "2.0.0"],
  has_standalone_library: true,
};

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/java-agent/instrumentation/:version/:name"
          element={<InstrumentationDetailPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("InstrumentationDetailPage", () => {
  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
  });

  describe("Loading state", () => {
    it("shows loading state while fetching data", () => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Loading instrumentation...")).toBeInTheDocument();
      expect(screen.getByText("This may take a moment")).toBeInTheDocument();
    });

    it("shows loading state while fetching versions", () => {
      vi.mocked(useVersions).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      vi.mocked(useInstrumentation).mockReturnValue({
        data: mockInstrumentation,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Loading instrumentation...")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message when instrumentation fails to load", () => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: null,
        loading: false,
        error: new Error("Failed to fetch instrumentation data"),
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Error loading instrumentation")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch instrumentation data")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    });
  });

  describe("Not found state", () => {
    it("shows not found message when instrumentation is null", () => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: null,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Instrumentation not found")).toBeInTheDocument();
      expect(screen.getByText(/The instrumentation "jdbc" could not be found/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    });
  });

  describe("Successful render", () => {
    beforeEach(() => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: mockInstrumentation,
        loading: false,
        error: null,
      });
    });

    it("renders instrumentation display name", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByRole("heading", { name: "JDBC", level: 1 })).toBeInTheDocument();
    });

    it("renders instrumentation description", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Instrumentation for JDBC database connections")).toBeInTheDocument();
    });

    it("shows raw name when different from display name", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Instrumentation Name:")).toBeInTheDocument();
      expect(screen.getByText("jdbc")).toBeInTheDocument();
    });

    it("does not show raw name when same as display name", () => {
      const instrWithSameName: InstrumentationData = {
        ...mockInstrumentation,
        display_name: "jdbc",
      };

      vi.mocked(useInstrumentation).mockReturnValue({
        data: instrWithSameName,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.queryByText("Instrumentation Name:")).not.toBeInTheDocument();
    });

    it("uses name as display name when display_name is missing", () => {
      const instrWithoutDisplayName: InstrumentationData = {
        ...mockInstrumentation,
        display_name: undefined,
      };

      vi.mocked(useInstrumentation).mockReturnValue({
        data: instrWithoutDisplayName,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByRole("heading", { name: "jdbc", level: 1 })).toBeInTheDocument();
      expect(screen.queryByText("Instrumentation Name:")).not.toBeInTheDocument();
    });

    it("displays version badge", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByText("Version:")).toBeInTheDocument();
      expect(screen.getByText("2.0.0")).toBeInTheDocument();
    });

    it("renders back button", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    });

    it("handles missing description gracefully", () => {
      const instrWithoutDescription: InstrumentationData = {
        ...mockInstrumentation,
        description: undefined,
      };

      vi.mocked(useInstrumentation).mockReturnValue({
        data: instrWithoutDescription,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      expect(screen.getByRole("heading", { name: "JDBC" })).toBeInTheDocument();
      expect(
        screen.queryByText("Instrumentation for JDBC database connections")
      ).not.toBeInTheDocument();
    });
  });

  describe("Version parameter handling", () => {
    it("extracts version from URL params", () => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: mockInstrumentation,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/1.9.0/jdbc");

      expect(screen.getByText("1.9.0")).toBeInTheDocument();
      expect(useInstrumentation).toHaveBeenCalledWith("jdbc", "1.9.0");
    });

    it("extracts name from URL params", () => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: mockInstrumentation,
        loading: false,
        error: null,
      });

      renderWithRouter("/java-agent/instrumentation/2.0.0/spring-webmvc");

      expect(useInstrumentation).toHaveBeenCalledWith("spring-webmvc", "2.0.0");
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(useInstrumentation).mockReturnValue({
        data: mockInstrumentation,
        loading: false,
        error: null,
      });
    });

    it("has proper heading hierarchy", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("JDBC");
    });

    it("back button is keyboard accessible", () => {
      renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

      const backButton = screen.getByRole("button", { name: "Back" });
      expect(backButton).toBeInTheDocument();
    });
  });
});
