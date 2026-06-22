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
import {
  SectionExpansionProvider,
  useCollapsibleExpansion,
  useSectionExpansion,
} from "./section-expansion-context";

function Probe({ k, def }: { k: string; def: boolean }) {
  const { open, onOpenChange } = useCollapsibleExpansion(k, def);
  return (
    <button aria-expanded={open} onClick={() => onOpenChange(!open)}>
      {k}
    </button>
  );
}

function Bulk() {
  const { expandAll, collapseAll } = useSectionExpansion();
  return (
    <>
      <button onClick={expandAll}>expand</button>
      <button onClick={collapseAll}>collapse</button>
    </>
  );
}

describe("useCollapsibleExpansion", () => {
  it("starts at defaultExpanded and toggles locally", () => {
    render(
      <SectionExpansionProvider>
        <Probe k="a" def={false} />
      </SectionExpansionProvider>
    );
    const b = screen.getByRole("button", { name: "a" });
    expect(b).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "true");
  });

  it("collapseAll then individual expand overrides only that key", () => {
    render(
      <SectionExpansionProvider>
        <Bulk />
        <Probe k="a" def={true} />
        <Probe k="b" def={true} />
      </SectionExpansionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "collapse" }));
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "b" })).toHaveAttribute("aria-expanded", "false");
  });

  it("expandAll then individual collapse overrides only that key", () => {
    render(
      <SectionExpansionProvider>
        <Bulk />
        <Probe k="a" def={false} />
        <Probe k="b" def={false} />
      </SectionExpansionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "expand" }));
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "b" })).toHaveAttribute("aria-expanded", "true");
  });

  it("falls back to defaultExpanded with no provider", () => {
    render(<Probe k="a" def={true} />);
    expect(screen.getByRole("button", { name: "a" })).toHaveAttribute("aria-expanded", "true");
  });
});
