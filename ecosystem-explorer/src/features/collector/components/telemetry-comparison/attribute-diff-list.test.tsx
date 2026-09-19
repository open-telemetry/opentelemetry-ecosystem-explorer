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
import { AttributeDiffList } from "./attribute-diff-list";
import type { CollectorAttributeChanges } from "@/types/collector";

function changes(overrides: Partial<CollectorAttributeChanges> = {}): CollectorAttributeChanges {
  return { added: [], removed: [], changed: [], ...overrides };
}

describe("AttributeDiffList", () => {
  it("renders a description-only change without implying the type changed", () => {
    // Regression guard: previously the row always rendered `before.type -> after.type`,
    // so a description-only change misleadingly showed "string -> string".
    render(
      <AttributeDiffList
        changes={changes({
          changed: [
            {
              key: "outcome",
              before: { description: "before", type: "string" },
              after: { description: "after", type: "string" },
            },
          ],
        })}
      />
    );
    expect(screen.queryByText("string → string")).not.toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("renders a type-only change with the before/after type diff", () => {
    render(
      <AttributeDiffList
        changes={changes({
          changed: [
            {
              key: "outcome",
              before: { description: "same", type: "string" },
              after: { description: "same", type: "int" },
            },
          ],
        })}
      />
    );
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("int")).toBeInTheDocument();
    // "Type" appears both as the column header and as this row's changed-field label.
    expect(screen.getAllByText("Type")).toHaveLength(2);
  });

  it("communicates an enum-only change", () => {
    render(
      <AttributeDiffList
        changes={changes({
          changed: [
            {
              key: "outcome",
              before: { description: "same", type: "string", enum: ["a", "b"] },
              after: { description: "same", type: "string", enum: ["a", "b", "c"] },
            },
          ],
        })}
      />
    );
    expect(screen.getByText("Enum")).toBeInTheDocument();
  });

  it("communicates a name-override-only change", () => {
    render(
      <AttributeDiffList
        changes={changes({
          changed: [
            {
              key: "outcome",
              before: { description: "same", type: "string", name_override: "old.name" },
              after: { description: "same", type: "string", name_override: "new.name" },
            },
          ],
        })}
      />
    );
    expect(screen.getByText("Name Override")).toBeInTheDocument();
  });

  it("returns null when there are no added/removed/changed attributes", () => {
    const { container } = render(<AttributeDiffList changes={changes()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses the DESIGN.md striped-table convention (bg-white/5 header, bg-muted/40 odd rows), matching the Java Agent table", () => {
    // Regression guard: this table previously used bg-muted/30 (header) and bg-muted/20 (odd
    // rows), an invented shade that didn't match DESIGN.md or attribute-diff-table.tsx (java-agent).
    const { container } = render(
      <AttributeDiffList
        changes={changes({
          added: [
            { key: "attr-a", definition: { description: "d", type: "string" } },
            { key: "attr-b", definition: { description: "d", type: "string" } },
          ],
        })}
      />
    );
    const headerRow = container.querySelector("thead tr");
    expect(headerRow).toHaveClass("bg-white/5");
    expect(headerRow).not.toHaveClass("bg-muted/30");

    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows[0]).not.toHaveClass("bg-muted/40");
    expect(bodyRows[1]).toHaveClass("bg-muted/40");
    expect(bodyRows[1]).not.toHaveClass("bg-muted/20");
  });
});
