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

  it("alternates row striping continuously across the added, removed, and changed groups", () => {
    // The three groups render as separate .map() passes but share one stripe counter
    // (`index + added.length`, then `index + added.length + removed.length`), so dropping
    // either offset would restart the stripe mid-table. Group sizes are deliberately 1/2/1:
    // both running offsets are then odd, so dropping either one flips a row's shade. An even
    // first group would make `index + added.length` congruent to `index` and hide the bug.
    // Rows are compared against each other, not a named shade, so a restyle doesn't break this.
    const { container } = render(
      <AttributeDiffList
        changes={changes({
          added: [{ key: "attr-a", definition: { description: "d", type: "string" } }],
          removed: [
            { key: "attr-b", definition: { description: "d", type: "string" } },
            { key: "attr-c", definition: { description: "d", type: "string" } },
          ],
          changed: [
            {
              key: "attr-d",
              before: { description: "d", type: "string" },
              after: { description: "d", type: "int" },
            },
          ],
        })}
      />
    );
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(4);
    expect(rows[0].className).toBe(rows[2].className);
    expect(rows[1].className).toBe(rows[3].className);
    expect(rows[0].className).not.toBe(rows[1].className);
  });
});
