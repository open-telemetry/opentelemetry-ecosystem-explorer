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
import { FieldMeta } from "./field-meta";

describe("FieldMeta", () => {
  it("returns null when node has no constraints and no defaultBehavior", () => {
    const { container } = render(<FieldMeta node={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders inclusive range when minimum and maximum are both set", () => {
    render(<FieldMeta node={{ constraints: { minimum: 0, maximum: 100 } }} />);
    expect(screen.getByText("0–100")).toBeInTheDocument();
  });

  it("renders ≥ min when only minimum is set", () => {
    render(<FieldMeta node={{ constraints: { minimum: 0 } }} />);
    expect(screen.getByText("≥ 0")).toBeInTheDocument();
  });

  it("renders > min when only exclusiveMinimum is set", () => {
    render(<FieldMeta node={{ constraints: { exclusiveMinimum: 0 } }} />);
    expect(screen.getByText("> 0")).toBeInTheDocument();
  });

  it("renders ≤ max when only maximum is set", () => {
    render(<FieldMeta node={{ constraints: { maximum: 100 } }} />);
    expect(screen.getByText("≤ 100")).toBeInTheDocument();
  });

  it("renders < max when only exclusiveMaximum is set", () => {
    render(<FieldMeta node={{ constraints: { exclusiveMaximum: 100 } }} />);
    expect(screen.getByText("< 100")).toBeInTheDocument();
  });

  it("renders '> min & < max' when both exclusive bounds are set", () => {
    render(<FieldMeta node={{ constraints: { exclusiveMinimum: 0, exclusiveMaximum: 10 } }} />);
    expect(screen.getByText("> 0 & < 10")).toBeInTheDocument();
  });

  it("prefers inclusive minimum when both minimum and exclusiveMinimum are set", () => {
    render(
      <FieldMeta node={{ constraints: { minimum: 0, exclusiveMinimum: -1, maximum: 100 } }} />
    );
    expect(screen.getByText("0–100")).toBeInTheDocument();
    expect(screen.queryByText("> -1")).not.toBeInTheDocument();
  });

  it("renders '1–10 items' when both minItems and maxItems are set", () => {
    render(<FieldMeta node={{ constraints: { minItems: 1, maxItems: 10 } }} />);
    expect(screen.getByText("1–10 items")).toBeInTheDocument();
  });

  it("renders '≥ 1 item' (singular) when minItems is 1", () => {
    render(<FieldMeta node={{ constraints: { minItems: 1 } }} />);
    expect(screen.getByText("≥ 1 item")).toBeInTheDocument();
  });

  it("renders '≥ 2 items' (plural) when minItems is 2", () => {
    render(<FieldMeta node={{ constraints: { minItems: 2 } }} />);
    expect(screen.getByText("≥ 2 items")).toBeInTheDocument();
  });

  it("renders '≤ 10 items' when only maxItems is set", () => {
    render(<FieldMeta node={{ constraints: { maxItems: 10 } }} />);
    expect(screen.getByText("≤ 10 items")).toBeInTheDocument();
  });

  it("renders defaultBehavior with a 'Default:' prefix on its own line", () => {
    render(<FieldMeta node={{ defaultBehavior: "128" }} />);
    expect(screen.getByText("Default:")).toBeInTheDocument();
    expect(screen.getByText("128", { exact: false })).toBeInTheDocument();
  });

  it("places constraint chips in their own row above the default-behavior line", () => {
    const { container } = render(
      <FieldMeta node={{ constraints: { minimum: 0, maximum: 100 }, defaultBehavior: "50" }} />
    );
    const root = container.firstChild as HTMLElement;
    const rows = root.children;
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("0–100");
    expect(rows[1].textContent).toContain("Default:");
    expect(rows[1].textContent).toContain("50");
  });

  it("each constraint chip is whitespace-nowrap so its icon and text never wrap inside the chip", () => {
    render(<FieldMeta node={{ constraints: { minimum: 0 } }} />);
    const chip = screen.getByText("≥ 0");
    expect(chip.className).toMatch(/whitespace-nowrap/);
  });

  it("renders only the chips row when no defaultBehavior is set", () => {
    const { container } = render(<FieldMeta node={{ constraints: { minimum: 0 } }} />);
    const root = container.firstChild as HTMLElement;
    expect(root.children).toHaveLength(1);
    expect(root.children[0].textContent).toContain("≥ 0");
  });

  it("renders only the default row when no constraints are set", () => {
    const { container } = render(<FieldMeta node={{ defaultBehavior: "anything" }} />);
    const root = container.firstChild as HTMLElement;
    expect(root.children).toHaveLength(1);
    expect(root.children[0].textContent).toContain("Default:");
    expect(root.children[0].textContent).toContain("anything");
  });
});
