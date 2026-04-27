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
import { PreviewCard } from "./preview-card";
import type { ConfigNode } from "@/types/configuration";

const schema: ConfigNode = {
  controlType: "group",
  key: "root",
  label: "Root",
  path: "",
  children: [],
};

const enableAllSections = vi.fn();
const resetToDefaults = vi.fn();
const confirmSpy = vi.fn(() => true);

vi.stubGlobal("confirm", confirmSpy);

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: {},
      version: "1.0.0",
      isDirty: false,
    },
    enableAllSections: (...a: unknown[]) => enableAllSections(...a),
    resetToDefaults: (...a: unknown[]) => resetToDefaults(...a),
    setValue: vi.fn(),
    setEnabled: vi.fn(),
    selectPlugin: vi.fn(),
    validateAll: vi.fn(),
  }),
}));

describe("PreviewCard", () => {
  it("renders the Output Preview title and action buttons", () => {
    render(<PreviewCard schema={schema} />);
    expect(screen.getByText("Output Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add all/i })).toBeInTheDocument();
  });

  it("triggers enableAllSections on Add all click", () => {
    render(<PreviewCard schema={schema} />);
    fireEvent.click(screen.getByRole("button", { name: /add all/i }));
    expect(enableAllSections).toHaveBeenCalledTimes(1);
  });

  it("Reset calls resetToDefaults (no confirm when state is clean)", () => {
    render(<PreviewCard schema={schema} />);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(resetToDefaults).toHaveBeenCalledTimes(1);
  });

  it("renders the YAML output via YamlCodeBlock with token spans", () => {
    const { container } = render(<PreviewCard schema={schema} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.querySelectorAll("span.y-key").length).toBeGreaterThan(0);
    expect(pre?.querySelectorAll("span.y-comment").length).toBeGreaterThan(0);
    expect(pre?.querySelectorAll("span.y-punct").length).toBeGreaterThan(0);
  });
});
