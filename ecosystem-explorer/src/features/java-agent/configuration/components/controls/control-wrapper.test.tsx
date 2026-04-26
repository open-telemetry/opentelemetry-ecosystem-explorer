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
import { render, screen, fireEvent } from "@testing-library/react";
import { ControlWrapper } from "./control-wrapper";
import type { ConfigNodeBase } from "@/types/configuration";

const baseNode: ConfigNodeBase = {
  controlType: "text_input",
  key: "endpoint",
  label: "Endpoint",
  path: "exporter.endpoint",
};

describe("ControlWrapper", () => {
  it("renders label", () => {
    render(
      <ControlWrapper node={baseNode} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.getByText("Endpoint")).toBeInTheDocument();
  });

  it("renders required asterisk when required", () => {
    const node = { ...baseNode, required: true };
    render(
      <ControlWrapper node={node} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders stability badge when development", () => {
    const node = { ...baseNode, stability: "development" as const };
    render(
      <ControlWrapper node={node} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.getByText("dev")).toBeInTheDocument();
  });

  it("renders a 'default' badge when nullable + isNull", () => {
    const node = { ...baseNode, nullable: true } as const;
    render(
      <ControlWrapper
        node={node}
        isNull={true}
        defaultPreview={{ value: true, description: "true is used" }}
      >
        <span>switch</span>
      </ControlWrapper>
    );
    expect(screen.getByText(/^default$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set value/i })).toBeNull();
  });

  it("renders a 'Reset' link when nullable + value is set, and clicking calls onClear", () => {
    const onClear = vi.fn();
    const node = { ...baseNode, nullable: true } as const;
    render(
      <ControlWrapper node={node} isNull={false} onClear={onClear}>
        <span>switch</span>
      </ControlWrapper>
    );
    const reset = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(reset);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("does not render any 'Set value' affordance regardless of input shape", () => {
    const node = { ...baseNode, nullable: true } as const;
    render(
      <ControlWrapper node={node} isNull={true}>
        <input data-testid="x" />
      </ControlWrapper>
    );
    expect(screen.queryByRole("button", { name: /set value/i })).toBeNull();
  });

  it("does not render a Reset link for non-nullable fields", () => {
    render(
      <ControlWrapper node={baseNode} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
  });

  it("links label to input via htmlFor when inputId provided", () => {
    render(
      <ControlWrapper node={baseNode} inputId="my-input" onClear={vi.fn()}>
        <input id="my-input" />
      </ControlWrapper>
    );
    const label = screen.getByText("Endpoint").closest("label");
    expect(label).toHaveAttribute("for", "my-input");
  });

  it("renders defaultBehavior via FieldMeta when not in null state", () => {
    const node = { ...baseNode, defaultBehavior: "30 seconds" };
    render(
      <ControlWrapper node={node} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.getByText("30 seconds")).toBeInTheDocument();
  });

  it("uses defaultPreview.description in the meta line when isNull and defaultPreview is given", () => {
    const node = { ...baseNode, nullable: true, defaultBehavior: "raw schema text" } as const;
    render(
      <ControlWrapper
        node={node}
        isNull={true}
        defaultPreview={{ value: null, description: "human readable fallback" }}
      >
        <input />
      </ControlWrapper>
    );
    expect(screen.getByText("human readable fallback")).toBeInTheDocument();
  });

  it("renders the error message when error prop is set", () => {
    render(
      <ControlWrapper node={baseNode} error="Required" onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("suppresses the label row when node.hideLabel is true", () => {
    const hiddenLabelNode = { ...baseNode, hideLabel: true };
    render(
      <ControlWrapper node={hiddenLabelNode}>
        <input aria-label="test-input" />
      </ControlWrapper>
    );
    expect(screen.queryByText(hiddenLabelNode.label)).not.toBeInTheDocument();
  });

  it("renders an ⓘ tooltip for the description and links it via aria-describedby", () => {
    const node = { ...baseNode, description: "URL to send telemetry to." };
    render(
      <ControlWrapper node={node} inputId="my-input" descriptionId="my-desc">
        <input id="my-input" aria-describedby="my-desc" />
      </ControlWrapper>
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.id).toBe("my-desc");
    expect(tooltip).toHaveTextContent("URL to send telemetry to.");
    expect(screen.queryAllByText("URL to send telemetry to.")).toHaveLength(1);
  });

  it("omits the error region when error is null or undefined", () => {
    const { rerender } = render(
      <ControlWrapper node={baseNode} error={null} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(
      <ControlWrapper node={baseNode} onClear={vi.fn()}>
        <input />
      </ControlWrapper>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("places children inline with the label when inlineControl is true", () => {
    const node = { ...baseNode, label: "Enabled" };
    render(
      <ControlWrapper node={node} inlineControl>
        <button data-testid="ctl">switch</button>
      </ControlWrapper>
    );
    const label = screen.getByText("Enabled");
    const ctl = screen.getByTestId("ctl");
    // Inline mode: label and ctl share the flex label row as their nearest <div>.
    expect(label.closest("div")).toBe(ctl.closest("div"));
  });

  it("stacks label above children by default (inlineControl undefined)", () => {
    render(
      <ControlWrapper node={baseNode}>
        <input data-testid="ctl" />
      </ControlWrapper>
    );
    const label = screen.getByText("Endpoint");
    const ctl = screen.getByTestId("ctl");
    expect(label.parentElement).not.toBe(ctl.parentElement);
  });
});
