import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { InstrumentationGroupCard } from "./instrumentation-group-card";
import type { InstrumentationGroup } from "../utils/group-instrumentations";
import type { FilterState } from "./instrumentation-filter-bar";

function renderGroupCard(
  group: InstrumentationGroup,
  activeFilters?: FilterState,
  version = "2.0.0"
) {
  return render(
    <BrowserRouter>
      <InstrumentationGroupCard group={group} activeFilters={activeFilters} version={version} />
    </BrowserRouter>
  );
}

const defaultFilters: FilterState = {
  search: "",
  telemetry: new Set(),
  target: new Set(),
};

describe("InstrumentationGroupCard", () => {
  describe("singleton group (1 instrumentation)", () => {
    const singletonGroup: InstrumentationGroup = {
      displayName: "JDBC",
      instrumentations: [
        {
          name: "jdbc",
          display_name: "JDBC",
          description: "Database instrumentation",
          scope: { name: "jdbc" },
          has_standalone_library: true,
          telemetry: [
            {
              when: "always",
              metrics: [
                { name: "db.connections", description: "DB connections", type: "GAUGE", unit: "1" },
              ],
            },
          ],
        },
      ],
    };

    it("renders as a regular InstrumentationCard link", () => {
      renderGroupCard(singletonGroup, defaultFilters);

      expect(screen.getByText("JDBC")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "View details for JDBC" })).toBeInTheDocument();
    });

    it("does not show version count badge", () => {
      renderGroupCard(singletonGroup, defaultFilters);

      expect(screen.queryByText(/versions/)).not.toBeInTheDocument();
    });

    it("does not show expand/collapse button", () => {
      renderGroupCard(singletonGroup, defaultFilters);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("multi-instrumentation group", () => {
    const multiGroup: InstrumentationGroup = {
      displayName: "Apache HttpClient",
      instrumentations: [
        {
          name: "apache-httpclient-4.0",
          display_name: "Apache HttpClient",
          description: "Instrumentation for Apache HttpClient version 4",
          scope: { name: "io.opentelemetry.apache-httpclient-4.0" },
          javaagent_target_versions: ["org.apache.httpcomponents:httpclient:[4.0,)"],
          telemetry: [{ when: "default", spans: [{ span_kind: "CLIENT" }] }],
        },
        {
          name: "apache-httpclient-5.0",
          display_name: "Apache HttpClient",
          description: "Instrumentation for Apache HttpClient version 5",
          scope: { name: "io.opentelemetry.apache-httpclient-5.0" },
          javaagent_target_versions: ["org.apache.httpcomponents.client5:httpclient5:[5.0,)"],
          has_standalone_library: true,
          telemetry: [
            {
              when: "default",
              spans: [{ span_kind: "CLIENT" }],
              metrics: [
                {
                  name: "http.client.request.duration",
                  description: "Duration of HTTP client requests",
                  type: "HISTOGRAM",
                  unit: "s",
                },
              ],
            },
          ],
        },
      ],
    };

    it("renders group display name", () => {
      renderGroupCard(multiGroup, defaultFilters);

      expect(screen.getByText("Apache HttpClient")).toBeInTheDocument();
    });

    it("shows version count badge", () => {
      renderGroupCard(multiGroup, defaultFilters);

      expect(screen.getByText("2 versions")).toBeInTheDocument();
    });

    it("renders as a button (expandable), not a link", () => {
      renderGroupCard(multiGroup, defaultFilters);

      const button = screen.getByRole("button", {
        name: /Apache HttpClient group with 2 instrumentations/,
      });
      expect(button).toBeInTheDocument();
    });

    it("sub-items are not rendered when collapsed", () => {
      renderGroupCard(multiGroup, defaultFilters);

      expect(
        screen.queryByRole("link", { name: "View details for apache-httpclient-4.0" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "View details for apache-httpclient-5.0" })
      ).not.toBeInTheDocument();
    });

    it("expands to show sub-items when clicked", async () => {
      const user = userEvent.setup();
      renderGroupCard(multiGroup, defaultFilters);

      const button = screen.getByRole("button", {
        name: /Apache HttpClient group with 2 instrumentations/,
      });
      await user.click(button);

      expect(
        screen.getByRole("link", { name: "View details for apache-httpclient-4.0" })
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "View details for apache-httpclient-5.0" })
      ).toBeVisible();
    });

    it("collapses sub-items when clicked again", async () => {
      const user = userEvent.setup();
      renderGroupCard(multiGroup, defaultFilters);

      const button = screen.getByRole("button", {
        name: /Apache HttpClient group with 2 instrumentations/,
      });

      // Expand
      await user.click(button);
      expect(
        screen.getByRole("link", { name: "View details for apache-httpclient-4.0" })
      ).toBeInTheDocument();

      // Collapse
      await user.click(button);
      expect(
        screen.queryByRole("link", { name: "View details for apache-httpclient-4.0" })
      ).not.toBeInTheDocument();
    });

    it("sets aria-expanded correctly", async () => {
      const user = userEvent.setup();
      renderGroupCard(multiGroup, defaultFilters);

      const button = screen.getByRole("button", {
        name: /Apache HttpClient group with 2 instrumentations/,
      });

      expect(button).toHaveAttribute("aria-expanded", "false");

      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("shows aggregated Agent badge when any instrumentation has javaagent target", () => {
      renderGroupCard(multiGroup, defaultFilters);

      expect(screen.getByTitle("Java Agent")).toBeInTheDocument();
    });

    it("shows aggregated Library badge when any instrumentation has standalone library", () => {
      renderGroupCard(multiGroup, defaultFilters);

      expect(screen.getByTitle("Standalone Library")).toBeInTheDocument();
    });

    it("shows aggregated Spans badge when any instrumentation has spans", () => {
      renderGroupCard(multiGroup, defaultFilters);

      const spansBadges = screen.getAllByText("Spans");
      expect(spansBadges.length).toBeGreaterThanOrEqual(1);
    });

    it("shows aggregated Metrics badge when any instrumentation has metrics", () => {
      renderGroupCard(multiGroup, defaultFilters);

      const metricsBadges = screen.getAllByText("Metrics");
      expect(metricsBadges.length).toBeGreaterThanOrEqual(1);
    });

    it("sub-items link to correct detail URLs", async () => {
      const user = userEvent.setup();
      renderGroupCard(multiGroup, defaultFilters, "2.25.0");

      const button = screen.getByRole("button", {
        name: /Apache HttpClient group with 2 instrumentations/,
      });
      await user.click(button);

      const link40 = screen.getByRole("link", {
        name: "View details for apache-httpclient-4.0",
      });
      expect(link40).toHaveAttribute(
        "href",
        "/java-agent/instrumentation/2.25.0/apache-httpclient-4.0"
      );

      const link50 = screen.getByRole("link", {
        name: "View details for apache-httpclient-5.0",
      });
      expect(link50).toHaveAttribute(
        "href",
        "/java-agent/instrumentation/2.25.0/apache-httpclient-5.0"
      );
    });

    it("shows group description from first instrumentation with a description", () => {
      renderGroupCard(multiGroup, defaultFilters);

      expect(
        screen.getByText("Instrumentation for Apache HttpClient version 4")
      ).toBeInTheDocument();
    });
  });

  describe("group with no telemetry or targets", () => {
    const bareGroup: InstrumentationGroup = {
      displayName: "Bare Group",
      instrumentations: [
        { name: "bare-1.0", scope: { name: "bare" } },
        { name: "bare-2.0", scope: { name: "bare" } },
      ],
    };

    it("does not show Agent, Library, Spans, or Metrics badges", () => {
      renderGroupCard(bareGroup, defaultFilters);

      expect(screen.queryByText("Agent")).not.toBeInTheDocument();
      expect(screen.queryByText("Library")).not.toBeInTheDocument();
      expect(screen.queryByText("Spans")).not.toBeInTheDocument();
      expect(screen.queryByText("Metrics")).not.toBeInTheDocument();
    });
  });
});
