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
import userEvent from "@testing-library/user-event";
import { CollectorFeatureGatesTab } from "./collector-feature-gates-tab";
import type { FeatureGate } from "@/types/collector";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fullGate: FeatureGate = {
  id: "receiver.awsxray.DontEmitV1HttpConventions",
  stage: "alpha",
  description: "Disables semconv legacy HTTP attributes.",
  from_version: "v0.158.0",
  to_version: "v0.160.0",
  reference_url: "https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/44052",
};

const minimalGate: FeatureGate = {
  id: "receiver.awsxray.MinimalGate",
  stage: "beta",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CollectorFeatureGatesTab", () => {
  it("renders the gate id and stage badge", () => {
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    expect(screen.getByText("receiver.awsxray.DontEmitV1HttpConventions")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("starts with all cards expanded by default", () => {
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    expect(screen.getByText("Disables semconv legacy HTTP attributes.")).toBeInTheDocument();
  });

  it("collapses a card when its header button is clicked", async () => {
    const user = userEvent.setup();
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    await user.click(screen.getByRole("button", { name: /DontEmitV1HttpConventions/i }));
    expect(screen.queryByText("Disables semconv legacy HTTP attributes.")).not.toBeInTheDocument();
  });

  it("expands a collapsed card when its header button is clicked again", async () => {
    const user = userEvent.setup();
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    const button = screen.getByRole("button", { name: /DontEmitV1HttpConventions/i });
    await user.click(button);
    await user.click(button);
    expect(screen.getByText("Disables semconv legacy HTTP attributes.")).toBeInTheDocument();
  });

  it("shows introduced-in and stable-in version pills when present", () => {
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    expect(screen.getByText("Introduced in v0.158.0")).toBeInTheDocument();
    expect(screen.getByText("Stable in v0.160.0")).toBeInTheDocument();
  });

  it("shows introduced-in and deprecated-in version pills when stage is deprecated", () => {
    const deprecatedGate: FeatureGate = {
      id: "receiver.awsxray.DeprecatedGate",
      stage: "deprecated",
      from_version: "v0.158.0",
      to_version: "v0.160.0",
    };
    render(<CollectorFeatureGatesTab featureGates={[deprecatedGate]} />);
    expect(screen.getByText("Introduced in v0.158.0")).toBeInTheDocument();
    expect(screen.getByText("Deprecated in v0.160.0")).toBeInTheDocument();
  });

  it("shows a reference link when reference_url is present", () => {
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    const link = screen.getByRole("link", { name: /reference/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/44052"
    );
  });

  it("gracefully omits description, version pills, and reference link when absent", () => {
    render(<CollectorFeatureGatesTab featureGates={[minimalGate]} />);
    expect(screen.getByText("receiver.awsxray.MinimalGate")).toBeInTheDocument();
    expect(screen.queryByText(/introduced in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stable in/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /reference/i })).not.toBeInTheDocument();
  });

  it("renders multiple gates independently", () => {
    render(<CollectorFeatureGatesTab featureGates={[fullGate, minimalGate]} />);
    expect(screen.getByText("receiver.awsxray.DontEmitV1HttpConventions")).toBeInTheDocument();
    expect(screen.getByText("receiver.awsxray.MinimalGate")).toBeInTheDocument();
  });

  it("applies aria-expanded=true to expanded card buttons", () => {
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    const button = screen.getByRole("button", { name: /DontEmitV1HttpConventions/i });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("applies aria-expanded=false to collapsed card buttons", async () => {
    const user = userEvent.setup();
    render(<CollectorFeatureGatesTab featureGates={[fullGate]} />);
    const button = screen.getByRole("button", { name: /DontEmitV1HttpConventions/i });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
