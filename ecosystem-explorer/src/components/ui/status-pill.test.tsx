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
import { describe, it, expect } from "vitest";
import { StatusPill, type Stability } from "./status-pill";

// Locked color mapping per decision-log 2026-05-06.
// Each entry pins the base text class (light theme) and the dark-mode override
// against the rendered span's className. JSDOM does not evaluate Tailwind's
// `dark:` modifier, so these are static-string assertions on the className —
// they verify wiring, not visual output.
const VARIANTS: ReadonlyArray<{
  stability: Stability;
  label: string;
  base: string;
  dark: string;
}> = [
  {
    stability: "development",
    label: "Development",
    base: "text-slate-600",
    dark: "dark:text-slate-400",
  },
  { stability: "alpha", label: "Alpha", base: "text-orange-600", dark: "dark:text-orange-400" },
  { stability: "beta", label: "Beta", base: "text-blue-600", dark: "dark:text-blue-400" },
  { stability: "stable", label: "Stable", base: "text-green-600", dark: "dark:text-green-400" },
  { stability: "deprecated", label: "Deprecated", base: "text-red-600", dark: "dark:text-red-400" },
  {
    stability: "unmaintained",
    label: "Unmaintained",
    base: "text-red-600",
    dark: "dark:text-red-400",
  },
];

describe("StatusPill", () => {
  it.each(VARIANTS)(
    "renders $stability with $label label and $base + $dark classes",
    ({ stability, label, base, dark }) => {
      render(<StatusPill stability={stability} />);
      const pill = screen.getByText(label);
      expect(pill.className).toContain(base);
      expect(pill.className).toContain(dark);
    }
  );

  it("renders all six stability levels with title-case labels", () => {
    render(
      <>
        {VARIANTS.map(({ stability }) => (
          <StatusPill key={stability} stability={stability} />
        ))}
      </>
    );
    for (const { label } of VARIANTS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders deprecated and unmaintained with distinct labels but the same red classes", () => {
    render(
      <>
        <StatusPill stability="deprecated" />
        <StatusPill stability="unmaintained" />
      </>
    );
    const deprecated = screen.getByText("Deprecated");
    const unmaintained = screen.getByText("Unmaintained");
    expect(deprecated).not.toBe(unmaintained);
    expect(deprecated.className).toContain("text-red-600");
    expect(deprecated.className).toContain("dark:text-red-400");
    expect(unmaintained.className).toContain("text-red-600");
    expect(unmaintained.className).toContain("dark:text-red-400");
  });

  it("forwards className to the rendered element", () => {
    render(<StatusPill stability="stable" className="custom-class" />);
    expect(screen.getByText("Stable").className).toContain("custom-class");
  });
});
