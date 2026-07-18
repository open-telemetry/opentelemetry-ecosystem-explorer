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
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import * as downloadModule from "@/lib/download-text";
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
const validateAll = vi.fn();
const confirmSpy = vi.fn(() => true);
let mockValidationErrors: Record<string, string> = {};

vi.stubGlobal("confirm", confirmSpy);

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: mockValidationErrors,
      version: "1.0.0",
      isDirty: false,
    },
    enableAllSections: (...a: unknown[]) => enableAllSections(...a),
    resetToDefaults: (...a: unknown[]) => resetToDefaults(...a),
    setValue: vi.fn(),
    setEnabled: vi.fn(),
    selectPlugin: vi.fn(),
    validateAll: (...a: unknown[]) => validateAll(...a),
  }),
}));

const downloadSpy = vi.spyOn(downloadModule, "downloadText").mockImplementation(() => {});

describe("PreviewCard", () => {
  beforeEach(() => {
    downloadSpy.mockClear();
    mockValidationErrors = {};
  });

  afterAll(() => {
    downloadSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("renders the Output Preview title and action buttons", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    expect(screen.getByText("Output Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add all/i })).toBeInTheDocument();
  });

  it("triggers enableAllSections on Add all click", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    fireEvent.click(screen.getByRole("button", { name: /add all/i }));
    expect(enableAllSections).toHaveBeenCalledTimes(1);
  });

  it("Reset calls resetToDefaults (no confirm when state is clean)", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(resetToDefaults).toHaveBeenCalledTimes(1);
  });

  it("triggers validateAll on Copy click regardless of clipboard availability", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    const previewContainer = screen.getByLabelText("Output Preview");
    fireEvent.click(within(previewContainer).getByRole("button", { name: /copy/i }));
    expect(validateAll).toHaveBeenCalledTimes(1);
  });

  it("renders the YAML output via YamlCodeBlock with token spans", () => {
    const { container } = render(
      <PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />
    );
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.querySelectorAll("span.y-key").length).toBeGreaterThan(0);
    expect(pre?.querySelectorAll("span.y-comment").length).toBeGreaterThan(0);
    expect(pre?.querySelectorAll("span.y-punct").length).toBeGreaterThan(0);
  });

  it("includes the resolved Java agent version in the rendered YAML header", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    const codeBlock = screen.getByLabelText("Output Preview").querySelector("pre");
    expect(codeBlock).not.toBeNull();
    expect(codeBlock?.textContent).toContain("Schema version: 1.0.0");
    expect(codeBlock?.textContent).toContain("Java agent: 2.27.0");
  });

  it("renders the header without the agent line while the version is still loading", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="" activePreviewKey={null} />);
    const codeBlock = screen.getByLabelText("Output Preview").querySelector("pre");
    expect(codeBlock?.textContent).toContain("Schema version: 1.0.0");
    expect(codeBlock?.textContent).not.toContain("Java agent:");
  });

  it("reflects a non-latest Java agent version selection in the YAML header", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.26.1" activePreviewKey={null} />);
    const codeBlock = screen.getByLabelText("Output Preview").querySelector("pre");
    expect(codeBlock?.textContent).toContain("Java agent: 2.26.1");
  });

  it("downloads the YAML with the schema-versioned filename and agent-stamped content", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    const previewContainer = screen.getByLabelText("Output Preview");
    fireEvent.click(within(previewContainer).getByRole("button", { name: /download/i }));
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [filename, body, mime] = downloadSpy.mock.calls[0];
    expect(filename).toBe("otel-config-1.0.0.yaml");
    expect(body).toContain("Schema version: 1.0.0");
    expect(body).toContain("Java agent: 2.27.0");
    expect(mime).toBe("text/yaml");
  });

  it("disables the Download button and prevents download when validation errors are present", () => {
    mockValidationErrors = {
      "resource.attributes": "Duplicate key: only the last value for each key is kept.",
    };
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);
    const previewContainer = screen.getByLabelText("Output Preview");
    const downloadBtn = within(previewContainer).getByRole("button", { name: /download/i });
    expect(downloadBtn).toBeDisabled();
    fireEvent.click(downloadBtn);
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("renders expand preview button and opens dialog with controls when clicked", () => {
    render(<PreviewCard schema={schema} javaAgentVersion="2.27.0" activePreviewKey={null} />);

    const expandBtn = screen.getByRole("button", { name: /expand yaml preview/i });
    expect(expandBtn).toBeInTheDocument();

    expect(screen.queryByText("YAML Configuration Preview")).not.toBeInTheDocument();

    fireEvent.click(expandBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("YAML Configuration Preview")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Complete generated YAML configuration for your OpenTelemetry Java Agent."
      )
    ).toBeInTheDocument();

    // Verify content parity between inline preview and dialog
    const previewContainer = screen.getByLabelText("Output Preview");
    const inlinePre = previewContainer.querySelector("pre");
    const dialogPre = dialog.querySelector("pre");
    expect(dialogPre).not.toBeNull();
    expect(dialogPre?.textContent).toBe(inlinePre?.textContent);

    validateAll.mockClear();
    const modalCopyBtn = within(dialog).getByRole("button", { name: /copy/i });
    expect(modalCopyBtn).toBeInTheDocument();
    fireEvent.click(modalCopyBtn);
    expect(validateAll).toHaveBeenCalledTimes(1);

    downloadSpy.mockClear();
    validateAll.mockClear();
    const modalDownloadBtn = within(dialog).getByRole("button", { name: /download/i });
    expect(modalDownloadBtn).toBeInTheDocument();
    fireEvent.click(modalDownloadBtn);
    expect(validateAll).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
  });
});
