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
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import tailwind from "@tailwindcss/postcss";
import postcss, { type AcceptedPlugin, type Root, type Rule } from "postcss";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GlowBadge } from "@/components/ui/glow-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { ThemeProvider } from "@/theme-context";

let compiled: Root;
let initializeTheme: () => void;

beforeAll(async () => {
  const from = resolve("src/styles/index.css");
  // Compile the real entry point with the installed Tailwind plugin, including
  // its imports and selector flattening. jsdom cannot compute layered CSS.
  // Tailwind bundles another PostCSS 8 type tree; the runtime plugin API is shared.
  const plugin = tailwind({ optimize: true }) as AcceptedPlugin;
  const result = await postcss([plugin]).process(await readFile(from, "utf8"), { from });
  compiled = result.root;
  const html = new DOMParser().parseFromString(
    await readFile(resolve("index.html"), "utf8"),
    "text/html"
  );
  const script = html.querySelector("head script:not([src])")?.textContent;
  expect(script, "pre-paint theme initialization").toBeTruthy();
  initializeTheme = () => {
    new Function(script!)();
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

function darkColorRule(className: string): Rule {
  const rules: Rule[] = [];
  compiled.walkRules((rule) => {
    if (rule.selector.includes(`.${className.replace(":", "\\:")}`)) rules.push(rule);
  });
  // Ignore opacity variants that share the same prefix.
  const rule = rules.find((candidate) =>
    candidate.nodes.some(
      (node) =>
        node.type === "decl" &&
        node.prop === "color" &&
        node.value === `var(--color-${className.replace("dark:text-", "")})`
    )
  );
  expect(rule, `compiled rule for ${className}`).toBeDefined();
  return rule!;
}

describe("rendered badge theme selectors", () => {
  it.each([
    ["light", "light"],
    ["light", "dark"],
    ["dark", "light"],
    ["dark", "dark"],
  ] as const)("selected %s with OS %s controls the compiled dark colors", (mode, os) => {
    localStorage.setItem("td-color-theme", mode);
    vi.stubGlobal("matchMedia", () => ({
      matches: os === "dark",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <ThemeProvider>
        <StatusPill stability="stable" />
        <GlowBadge variant="info">Information</GlowBadge>
      </ThemeProvider>
    );

    for (const [badge, className] of [
      [screen.getByText("Stable"), "dark:text-green-400"],
      [screen.getByText("Information"), "dark:text-blue-400"],
    ] as const) {
      const rule = darkColorRule(className);
      expect(badge.matches(rule.selector)).toBe(mode === "dark");
      // A selector can match while an OS media query suppresses the rule.
      for (
        let parent: Rule["parent"] | Root["parent"] = rule.parent;
        parent;
        parent = parent.parent
      ) {
        if (parent.type === "atrule" && parent.name === "media") {
          expect(parent.params).not.toContain("prefers-color-scheme");
        }
      }
    }
  });
});

describe("pre-paint theme initialization", () => {
  it.each([
    ["light", "light", "light"],
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    ["dark", "dark", "dark"],
    ["auto", "light", "light"],
    ["auto", "dark", "dark"],
    [null, "light", "light"],
    [null, "dark", "dark"],
    ["invalid", "light", "light"],
    ["invalid", "dark", "dark"],
  ])("keeps stored %s with OS %s at %s through mount", (stored, os, expected) => {
    if (stored !== null) localStorage.setItem("td-color-theme", stored);
    vi.stubGlobal("matchMedia", () => ({
      matches: os === "dark",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    initializeTheme();
    expect(document.documentElement.dataset.theme).toBe(expected);
    render(
      <ThemeProvider>
        <StatusPill stability="stable" />
      </ThemeProvider>
    );
    expect(document.documentElement.dataset.theme).toBe(expected);
  });
});
