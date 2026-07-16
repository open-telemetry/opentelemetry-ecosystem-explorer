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
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalBadge } from "./signal-badge";

const styles = {
  active: "bg-blue-500/40 border-blue-400",
  inactive: "bg-blue-500/5 border-blue-500/20",
};

describe("SignalBadge", () => {
  it("renders the label and aria-label", () => {
    render(
      <SignalBadge
        label="Metrics"
        tooltip="Has metric telemetry"
        ariaLabel="Has metric telemetry"
        active={false}
        styles={styles}
      />
    );
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByLabelText("Has metric telemetry")).toBeInTheDocument();
  });

  it("applies the inactive styles by default", () => {
    render(
      <SignalBadge
        label="Metrics"
        tooltip="tooltip"
        ariaLabel="Metrics"
        active={false}
        styles={styles}
      />
    );
    expect(screen.getByText("Metrics").className).toContain(styles.inactive);
    expect(screen.getByText("Metrics").className).not.toContain(styles.active);
  });

  it("applies the active styles when active is true", () => {
    render(
      <SignalBadge
        label="Metrics"
        tooltip="tooltip"
        ariaLabel="Metrics"
        active={true}
        styles={styles}
      />
    );
    expect(screen.getByText("Metrics").className).toContain(styles.active);
  });

  it("uses compact size classes when size is compact", () => {
    render(
      <SignalBadge
        label="Metrics"
        tooltip="tooltip"
        ariaLabel="Metrics"
        active={false}
        styles={styles}
        size="compact"
      />
    );
    const badge = screen.getByText("Metrics");
    expect(badge.className).toContain("px-1.5");
    expect(badge.className).not.toContain("px-2");
  });

  it("is keyboard-focusable", () => {
    render(
      <SignalBadge
        label="Metrics"
        tooltip="tooltip"
        ariaLabel="Metrics"
        active={false}
        styles={styles}
      />
    );
    expect(screen.getByText("Metrics")).toHaveAttribute("tabIndex", "0");
  });
});
