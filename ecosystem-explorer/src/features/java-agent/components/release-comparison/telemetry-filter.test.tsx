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
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TelemetryFilter } from "./telemetry-filter";
import { FILTER_STYLES } from "../../styles/filter-styles";

describe("TelemetryFilter", () => {
  it("renders Spans and Metrics buttons with the Telemetry label", () => {
    render(<TelemetryFilter value={new Set()} onChange={vi.fn()} />);

    expect(screen.getByText("Telemetry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Metrics" })).toBeInTheDocument();
  });

  it("reflects selected types via aria-pressed", () => {
    render(<TelemetryFilter value={new Set(["spans"])} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Spans" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Metrics" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("applies the shared active/inactive filter styles", () => {
    render(<TelemetryFilter value={new Set(["spans"])} onChange={vi.fn()} />);

    const spansButton = screen.getByRole("button", { name: "Spans" });
    const metricsButton = screen.getByRole("button", { name: "Metrics" });
    expect(spansButton.className).toContain(FILTER_STYLES.telemetry.spans.active);
    expect(metricsButton.className).toContain(FILTER_STYLES.telemetry.metrics.inactive);
  });

  it("toggles a type on when clicking an inactive button, preserving the other selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TelemetryFilter value={new Set(["spans"])} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Metrics" }));

    expect(onChange).toHaveBeenCalledWith(new Set(["spans", "metrics"]));
  });

  it("toggles a type off when clicking an active button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TelemetryFilter value={new Set(["spans", "metrics"])} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Spans" }));

    expect(onChange).toHaveBeenCalledWith(new Set(["metrics"]));
  });
});
