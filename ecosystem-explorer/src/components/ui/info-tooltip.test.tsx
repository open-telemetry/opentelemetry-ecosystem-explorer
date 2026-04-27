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
  it("renders the tooltip element with the description text in the DOM", () => {
    render(<InfoTooltip text="Helpful description." />);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Helpful description.");
  });

  it("uses the supplied describedById on the tooltip element", () => {
    render(<InfoTooltip text="X" describedById="my-desc" />);
    expect(screen.getByRole("tooltip").id).toBe("my-desc");
  });

  it("auto-generates an id when describedById is not provided", () => {
    render(<InfoTooltip text="X" />);
    expect(screen.getByRole("tooltip").id.length).toBeGreaterThan(0);
  });

  it("makes the tooltip visible on trigger focus and hides it on blur", () => {
    render(<InfoTooltip text="X" />);
    const trigger = screen.getByRole("button", { name: /description/i });
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "false");
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "true");
    fireEvent.blur(trigger);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "false");
  });

  it("makes the tooltip visible while the wrapper is hovered", () => {
    const { container } = render(<InfoTooltip text="X" />);
    const wrapper = container.querySelector("span") as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "true");
    fireEvent.mouseLeave(wrapper);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "false");
  });

  it("closes on Escape", () => {
    render(<InfoTooltip text="X" />);
    const trigger = screen.getByRole("button", { name: /description/i });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "true");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-open", "false");
  });

  it("renders nothing when text is empty", () => {
    const { container } = render(<InfoTooltip text="" />);
    expect(container.firstChild).toBeNull();
  });
});
