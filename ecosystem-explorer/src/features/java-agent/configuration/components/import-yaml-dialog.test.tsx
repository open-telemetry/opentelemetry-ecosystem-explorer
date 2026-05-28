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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportYamlDialog } from "./import-yaml-dialog";

const loadFromYaml = vi.fn();

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: {},
      version: "1.0.0",
      isDirty: false,
    },
    loadFromYaml: (...args: unknown[]) => loadFromYaml(...args),
    setValue: vi.fn(),
  }),
}));

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /import/i }));
}

describe("ImportYamlDialog", () => {
  beforeEach(() => {
    loadFromYaml.mockReset();
    loadFromYaml.mockResolvedValue(undefined);
  });

  it("renders the Import trigger button", () => {
    render(<ImportYamlDialog />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("opens the dialog when the trigger is clicked", () => {
    render(<ImportYamlDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Import YAML Configuration")).toBeInTheDocument();
  });

  it("shows the textarea and Upload file button inside the dialog", () => {
    render(<ImportYamlDialog />);
    openDialog();
    expect(screen.getByRole("textbox", { name: /yaml content/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload file/i })).toBeInTheDocument();
  });

  it("shows an error when importing with an empty textarea", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /paste a yaml configuration or upload a file/i
      );
    });
    expect(loadFromYaml).not.toHaveBeenCalled();
  });

  it("shows a syntax error when the YAML is malformed", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: "key: [\nbad yaml" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid yaml syntax/i);
    });
    expect(loadFromYaml).not.toHaveBeenCalled();
  });

  it("shows an error when the YAML is a plain list, not a mapping", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: "- item1\n- item2\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/key-value mapping/i);
    });
    expect(loadFromYaml).not.toHaveBeenCalled();
  });

  it("shows an error when the YAML is a plain scalar, not a mapping", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: "just a string\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/key-value mapping/i);
    });
    expect(loadFromYaml).not.toHaveBeenCalled();
  });

  it("calls loadFromYaml and closes the dialog on a valid import", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    const validYaml = "exporters:\n  otlp:\n    endpoint: http://localhost:4317\n";
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: validYaml },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => {
      expect(loadFromYaml).toHaveBeenCalledWith(validYaml.trim());
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows an error if loadFromYaml rejects", async () => {
    loadFromYaml.mockRejectedValue(new Error("Schema mismatch"));
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: "key: value\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Schema mismatch");
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("clears the error when the user edits the textarea after a failed import", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: "k: v" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets textarea and error when the dialog is closed and reopened", async () => {
    render(<ImportYamlDialog />);
    openDialog();
    fireEvent.change(screen.getByRole("textbox", { name: /yaml content/i }), {
      target: { value: "some: yaml" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    openDialog();
    expect(screen.getByRole("textbox", { name: /yaml content/i })).toHaveValue("");
  });

  it("populates the textarea when a file is uploaded via FileReader", async () => {
    render(<ImportYamlDialog />);
    openDialog();

    const fileContent = "resource:\n  attributes:\n    service.name: my-service\n";
    const file = new File([fileContent], "otel-config.yaml", { type: "text/yaml" });

    const originalFileReader = globalThis.FileReader;
    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: fileContent } } as ProgressEvent<FileReader>);
          }
        }, 0);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /yaml content/i })).toHaveValue(fileContent);
    });

    globalThis.FileReader = originalFileReader;
  });

  it("has an accessible file input with aria-label", () => {
    render(<ImportYamlDialog />);
    openDialog();
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput?.getAttribute("aria-label")).toBe("Upload YAML file");
  });
});
