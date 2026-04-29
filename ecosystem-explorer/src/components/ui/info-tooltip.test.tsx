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
import { render, screen, fireEvent } from "@testing-library/react";
import { InfoTooltip } from "./info-tooltip";

describe("InfoTooltip", () => {
  it("renders nothing when text is empty", () => {
    const { container } = render(<InfoTooltip text="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when text is only whitespace", () => {
    const { container } = render(<InfoTooltip text={"  \n  "} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a trigger button labelled Description", () => {
    render(<InfoTooltip text="Helpful description." />);
    expect(screen.getByRole("button", { name: "Description" })).toBeInTheDocument();
  });

  it("renders the description text in an accessible element so screen readers reach it via aria-describedby", () => {
    render(<InfoTooltip text="Helpful description." />);
    const description = screen.getByText("Helpful description.");
    expect(description).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Description" });
    expect(trigger.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("uses the supplied describedById on the description element", () => {
    render(<InfoTooltip text="X" describedById="my-desc" />);
    expect(screen.getByText("X").id).toBe("my-desc");
  });

  it("auto-generates an id when describedById is not provided", () => {
    render(<InfoTooltip text="X" />);
    expect(screen.getByText("X").id.length).toBeGreaterThan(0);
  });

  it("starts with the hover card closed", () => {
    render(<InfoTooltip text="X" />);
    const trigger = screen.getByRole("button", { name: "Description" });
    expect(trigger).toHaveAttribute("data-state", "closed");
  });

  it("opens the popup on focus so sighted keyboard users see it", () => {
    render(<InfoTooltip text="Keyboard visible description." />);
    const trigger = screen.getByRole("button", { name: "Description" });
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute("data-state", "open");
  });

  it("closes the popup on blur", () => {
    render(<InfoTooltip text="Keyboard visible description." />);
    const trigger = screen.getByRole("button", { name: "Description" });
    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(trigger).toHaveAttribute("data-state", "closed");
  });
});
