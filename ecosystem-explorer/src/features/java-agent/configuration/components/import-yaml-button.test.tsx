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
import { ImportYamlButton } from "./import-yaml-button";

const loadFromYaml = vi.fn();

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    loadFromYaml: (...a: unknown[]) => loadFromYaml(...a),
  }),
}));

// jsdom does not implement HTMLDialogElement.showModal/close
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

describe("ImportYamlButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Import trigger button", () => {
    render(<ImportYamlButton />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("opens the dialog when the Import button is clicked", () => {
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Import YAML Configuration")).toBeInTheDocument();
  });

  it("closes the dialog when Cancel is clicked", () => {
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("closes the dialog when the X button is clicked", () => {
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    fireEvent.click(screen.getByRole("button", { name: /close import dialog/i }));
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("shows an error when Load is clicked without any YAML content", async () => {
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    fireEvent.click(screen.getByRole("button", { name: /load configuration/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please provide a YAML configuration to import."
    );
    expect(loadFromYaml).not.toHaveBeenCalled();
  });

  it("calls loadFromYaml with pasted YAML and closes the dialog on success", async () => {
    loadFromYaml.mockResolvedValueOnce(undefined);
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));

    fireEvent.change(screen.getByLabelText(/paste yaml/i), {
      target: { value: "file_format: '0.3'\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /load configuration/i }));

    await waitFor(() => {
      expect(loadFromYaml).toHaveBeenCalledWith("file_format: '0.3'");
    });
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("shows the error message when loadFromYaml rejects", async () => {
    loadFromYaml.mockRejectedValueOnce(new Error("Failed to parse YAML configuration"));
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));

    fireEvent.change(screen.getByLabelText(/paste yaml/i), {
      target: { value: "bad: yaml: :\n  wrong indent" },
    });
    fireEvent.click(screen.getByRole("button", { name: /load configuration/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to parse YAML configuration"
    );
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
  });

  it("clears error when the user edits the textarea after a failure", async () => {
    loadFromYaml.mockRejectedValueOnce(new Error("Failed to parse YAML configuration"));
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));

    const textarea = screen.getByLabelText(/paste yaml/i);
    fireEvent.change(textarea, { target: { value: "bad yaml" } });
    fireEvent.click(screen.getByRole("button", { name: /load configuration/i }));
    await screen.findByRole("alert");

    fireEvent.change(textarea, { target: { value: "file_format: '0.3'" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets the textarea and error when the dialog is reopened", async () => {
    loadFromYaml.mockRejectedValueOnce(new Error("Failed to parse YAML configuration"));
    render(<ImportYamlButton />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));

    fireEvent.change(screen.getByLabelText(/paste yaml/i), {
      target: { value: "bad yaml" },
    });
    fireEvent.click(screen.getByRole("button", { name: /load configuration/i }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /import/i }));

    expect(screen.getByLabelText(/paste yaml/i)).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
