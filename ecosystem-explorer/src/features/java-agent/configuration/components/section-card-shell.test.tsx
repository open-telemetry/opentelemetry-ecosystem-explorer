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
import { SectionCardShell } from "./section-card-shell";

describe("SectionCardShell", () => {
  it("does not call focus() on the section element when a child is clicked", () => {
    const { container } = render(
      <SectionCardShell sectionKey="resource">
        <input data-testid="leaf" />
      </SectionCardShell>
    );
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    const focusSpy = vi.spyOn(section as HTMLElement, "focus");
    fireEvent.click(screen.getByTestId("leaf"));
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("exposes data-section-key for the scroll-spy", () => {
    const { container } = render(
      <SectionCardShell sectionKey="tracer-provider">
        <p>body</p>
      </SectionCardShell>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-section-key")).toBe("tracer-provider");
  });

  it("does not accept isActive as a prop (compile-time guard)", () => {
    render(
      <SectionCardShell
        sectionKey="x"
        // @ts-expect-error: isActive is no longer part of SectionCardShellProps
        isActive
      >
        <p>body</p>
      </SectionCardShell>
    );
  });
});
