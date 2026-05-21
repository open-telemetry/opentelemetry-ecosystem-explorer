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
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "./dialog";

describe("Dialog", () => {
  it("renders trigger and displays dialog content when clicked", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button>Open Dialog</button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog Description</DialogDescription>
          <div>Dialog Content Body</div>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByText("Dialog Content Body")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Open Dialog" });
    fireEvent.click(trigger);

    expect(screen.getByText("Dialog Content Body")).toBeInTheDocument();
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    expect(screen.getByText("Dialog Description")).toBeInTheDocument();
  });

  it("closes dialog content when close button is clicked", async () => {
    render(
      <Dialog defaultOpen={true}>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog Description</DialogDescription>
          <div>Dialog Content Body</div>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText("Dialog Content Body")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Dialog Content Body")).not.toBeInTheDocument();
    });
  });
});
