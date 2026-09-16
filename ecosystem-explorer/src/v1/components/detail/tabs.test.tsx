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
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { AttributesTab, ConfigurationTab, DetailTabs, ExamplesTab, ReadmeTab } from "./tabs";

describe("DetailTabs", () => {
  it("exposes an accessible tablist and reports the active tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DetailTabs active="configuration" onChange={onChange}>
        <p>panel body</p>
      </DetailTabs>
    );

    expect(screen.getByRole("tablist", { name: "Component sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Configuration" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel body");

    await user.click(screen.getByRole("tab", { name: "Attributes" }));
    expect(onChange).toHaveBeenCalledWith("attributes");
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DetailTabs active="configuration" onChange={onChange}>
        <p>panel body</p>
      </DetailTabs>
    );

    // Focus follows the arrow key, so each press advances from the newly
    // focused tab. Right-cycling past the last tab wraps to the first.
    screen.getByRole("tab", { name: "Configuration" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("readme");
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("attributes");
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("examples");
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("configuration");
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("configuration");
  });
});

describe("ConfigurationTab", () => {
  it("renders the empty state with a source link when there are no rows", () => {
    render(<ConfigurationTab rows={null} hrefSource="https://github.com/open-telemetry/x" />);

    expect(screen.getByText("No configuration schema yet")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://github.com/open-telemetry/x");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders a table of rows when configuration is available", () => {
    render(
      <ConfigurationTab
        rows={[{ key: "endpoint", type: "string", defaultValue: "0.0.0.0:4317" }]}
        hrefSource={null}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Key" })).toBeInTheDocument();
    expect(screen.getByText("endpoint")).toBeInTheDocument();
    expect(screen.getByText("0.0.0.0:4317")).toBeInTheDocument();
  });
});

describe("ReadmeTab", () => {
  it("links out to the source repository", () => {
    render(<ReadmeTab hrefSource="https://github.com/open-telemetry/x" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("AttributesTab", () => {
  it("renders the empty state when there are no rows", () => {
    render(<AttributesTab rows={[]} />);
    expect(screen.getByText("Emitted attributes not catalogued yet")).toBeInTheDocument();
  });

  it("renders metric, attribute, and resource rows with localized kinds", () => {
    render(
      <AttributesTab
        rows={[
          { name: "otelcol_process_uptime", kind: "metric", description: "Uptime." },
          { name: "transport", kind: "attribute", description: "Transport protocol." },
          { name: "service.name", kind: "resource", description: "Service name." },
        ]}
      />
    );

    expect(screen.getByText("otelcol_process_uptime")).toBeInTheDocument();
    expect(screen.getByText("Metric")).toBeInTheDocument();
    expect(screen.getByText("Attribute")).toBeInTheDocument();
    expect(screen.getByText("Resource attribute")).toBeInTheDocument();
  });
});

describe("ExamplesTab", () => {
  it("renders the empty state with a link-out when there are no snippets", () => {
    render(<ExamplesTab snippets={[]} hrefExamples="https://github.com/open-telemetry/x" />);

    expect(screen.getByText("No curated examples yet")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders snippet cards when snippets are provided", () => {
    render(
      <ExamplesTab
        snippets={[{ title: "Minimal config", code: "receivers:\n  otlp:" }]}
        hrefExamples={null}
      />
    );

    expect(screen.getByRole("heading", { name: "Minimal config" })).toBeInTheDocument();
    expect(screen.getByText(/receivers:/)).toBeInTheDocument();
  });
});
