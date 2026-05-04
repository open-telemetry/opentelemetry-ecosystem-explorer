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
import { afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "@/components/ui/copy-button";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("CopyButton", () => {
  it("writes the text prop to the clipboard on click", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<CopyButton text="hello" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("flashes the copied label after a successful click and reverts", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<CopyButton text="hello" />);
    // fireEvent is synchronous; fake timers don't block it.
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    // Let the clipboard Promise microtask settle before asserting.
    await act(async () => {});

    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => vi.runAllTimers());

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("calls onCopy after a successful clipboard write", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const onCopy = vi.fn();

    render(<CopyButton text="hello" onCopy={onCopy} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledTimes(1);
    });
  });

  it("does not flash or call onCopy when the clipboard write rejects", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() =>
      Promise.reject(new Error("denied"))
    );
    const onCopy = vi.fn();

    render(<CopyButton text="hello" onCopy={onCopy} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));

    // Give the rejected promise microtask a chance to settle
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("renders custom labels when provided", () => {
    render(<CopyButton text="x" label="Copy YAML" copiedLabel="Done" />);
    expect(screen.getByRole("button", { name: "Copy YAML" })).toBeInTheDocument();
  });

  it("clears the previous flash timeout when clicked again before it fires", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const user = userEvent.setup();

    render(<CopyButton text="hello" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" });

    const callsAfterFirstClick = clearTimeoutSpy.mock.calls.length;

    // Second click while still in the "Copied" window
    await user.click(screen.getByRole("button", { name: "Copied" }));
    await waitFor(() => {
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsAfterFirstClick);
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
