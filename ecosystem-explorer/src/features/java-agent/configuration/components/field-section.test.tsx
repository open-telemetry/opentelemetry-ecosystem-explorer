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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldSection, useFieldSectionCanAdd } from "./field-section";
import type { GroupNode, ListNode } from "@/types/configuration";

const groupNode: GroupNode = {
  controlType: "group",
  key: "tracer",
  label: "Tracer Provider",
  path: "tracer_provider",
  children: [],
};

describe("FieldSection — root", () => {
  it("renders a role=group wrapper at level=field with aria-labelledby pointing at the label", () => {
    render(
      <FieldSection node={groupNode} level="field">
        <FieldSection.Header>
          <FieldSection.Label />
        </FieldSection.Header>
      </FieldSection>
    );
    const group = screen.getByRole("group", { name: "Tracer Provider" });
    const heading = screen.getByRole("heading", { level: 4, name: "Tracer Provider" });
    expect(group).toContainElement(heading);
    expect(group.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("FieldSection — section level", () => {
  it("renders the label as h3 at level=section", () => {
    render(
      <FieldSection node={groupNode} level="section">
        <FieldSection.Header>
          <FieldSection.Label />
        </FieldSection.Header>
      </FieldSection>
    );
    expect(screen.getByRole("heading", { level: 3, name: "Tracer Provider" })).toBeInTheDocument();
  });
});

describe("FieldSection — chevron + body", () => {
  it("hides the body when defaultExpanded=false and renders a chevron with aria-expanded/aria-controls", () => {
    render(
      <FieldSection node={groupNode} level="field" defaultExpanded={false}>
        <FieldSection.Header>
          <FieldSection.Chevron />
          <FieldSection.Label />
        </FieldSection.Header>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    const chevron = screen.getByRole("button", { name: /Expand|Collapse/ });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(chevron).toHaveAttribute("aria-controls");
    expect(screen.queryByText("body content")).toBeNull();
  });

  it("toggles the body when the chevron is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FieldSection node={groupNode} level="field" defaultExpanded={false}>
        <FieldSection.Header>
          <FieldSection.Chevron />
          <FieldSection.Label />
        </FieldSection.Header>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    await user.click(screen.getByRole("button", { name: /Expand/ }));
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("renders the body by default at level=field (no chevron, no defaultExpanded)", () => {
    render(
      <FieldSection node={groupNode} level="field">
        <FieldSection.Header>
          <FieldSection.Label />
        </FieldSection.Header>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("body has id matching aria-controls on chevron", () => {
    render(
      <FieldSection node={groupNode} level="field">
        <FieldSection.Header>
          <FieldSection.Chevron />
          <FieldSection.Label />
        </FieldSection.Header>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    const chevron = screen.getByRole("button", { name: /Collapse/ });
    const body = screen.getByText("body content").closest("[id]");
    expect(chevron.getAttribute("aria-controls")).toBe(body?.getAttribute("id"));
  });
});

const listNode: ListNode = {
  controlType: "list",
  key: "processors",
  label: "Processors",
  path: "tp.processors",
  itemSchema: { controlType: "group", key: "item", label: "Item", path: "x", children: [] },
};

describe("FieldSection — stability/info/description", () => {
  it("renders StabilityBadge whenever node.stability is set, at any level", () => {
    const dev = { ...groupNode, stability: "development" as const };
    const { rerender } = render(
      <FieldSection node={dev} level="section">
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Stability />
        </FieldSection.Header>
      </FieldSection>
    );
    expect(screen.getByText("dev")).toBeInTheDocument();
    rerender(
      <FieldSection node={dev} level="field">
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Stability />
        </FieldSection.Header>
      </FieldSection>
    );
    expect(screen.getByText("dev")).toBeInTheDocument();
  });

  it("renders nothing when node.stability is unset", () => {
    render(
      <FieldSection node={groupNode} level="field">
        <FieldSection.Header>
          <FieldSection.Stability />
        </FieldSection.Header>
      </FieldSection>
    );
    expect(screen.queryByText("dev")).toBeNull();
  });

  it("renders InfoTooltip from node.description in the header", () => {
    const withDesc = { ...groupNode, description: "Configures the tracer." };
    render(
      <FieldSection node={withDesc} level="field">
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Info />
        </FieldSection.Header>
      </FieldSection>
    );
    expect(screen.getByText("Configures the tracer.")).toBeInTheDocument();
  });

  it("renders TruncatedDescription only at level=section via .Description", () => {
    const withDesc = { ...groupNode, description: "Long description." };
    render(
      <FieldSection node={withDesc} level="section">
        <FieldSection.Header>
          <FieldSection.Label />
        </FieldSection.Header>
        <FieldSection.Description />
      </FieldSection>
    );
    expect(screen.getByText("Long description.")).toBeInTheDocument();
  });
});

describe("FieldSection — empty", () => {
  it("renders a p with role=status and the default text", () => {
    render(
      <FieldSection node={groupNode} level="field">
        <FieldSection.Body>
          <FieldSection.Empty />
        </FieldSection.Body>
      </FieldSection>
    );
    const empty = screen.getByRole("status");
    expect(empty.tagName).toBe("P");
    expect(empty).toHaveTextContent("No items yet");
  });

  it("uses the children text when provided", () => {
    render(
      <FieldSection node={groupNode} level="field">
        <FieldSection.Body>
          <FieldSection.Empty>No entries yet</FieldSection.Empty>
        </FieldSection.Body>
      </FieldSection>
    );
    expect(screen.getByRole("status")).toHaveTextContent("No entries yet");
  });
});

describe("FieldSection — action slot", () => {
  it("renders children with ml-auto", () => {
    render(
      <FieldSection node={listNode} level="field">
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Action>
            <button type="button">+ Add</button>
          </FieldSection.Action>
        </FieldSection.Header>
      </FieldSection>
    );
    const btn = screen.getByRole("button", { name: "+ Add" });
    expect(btn.parentElement).toHaveClass("ml-auto");
  });

  it("hides the slot when canAdd is false (maxItems reached) but keeps children mounted", () => {
    const capped: ListNode = { ...listNode, constraints: { maxItems: 2 } };
    render(
      <FieldSection node={capped} level="field" value={[{}, {}]}>
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Action>
            <button type="button" data-testid="add">
              + Add
            </button>
          </FieldSection.Action>
        </FieldSection.Header>
      </FieldSection>
    );
    const btn = screen.getByTestId("add");
    expect(btn).not.toBeVisible();
  });
});

describe("FieldSection — useFieldSectionCanAdd", () => {
  it("exposes canAdd via the hook", () => {
    const capped: ListNode = { ...listNode, constraints: { maxItems: 1 } };
    function Probe() {
      const { canAdd } = useFieldSectionCanAdd();
      return <span data-testid="probe">{String(canAdd)}</span>;
    }
    render(
      <FieldSection node={capped} level="field" value={[{}]}>
        <Probe />
      </FieldSection>
    );
    expect(screen.getByTestId("probe").textContent).toBe("false");
  });
});

describe("FieldSection — headless", () => {
  it("suppresses the header but keeps role=group + aria-labelledby (using labelledBy prop)", () => {
    render(
      <>
        <h3 id="outer-label">Outer Label</h3>
        <FieldSection node={groupNode} level="field" headless labelledBy="outer-label">
          <FieldSection.Header>
            <FieldSection.Label />
          </FieldSection.Header>
          <FieldSection.Body>
            <p>body content</p>
          </FieldSection.Body>
        </FieldSection>
      </>
    );
    expect(screen.queryByRole("heading", { level: 4 })).toBeNull();
    const group = screen.getByRole("group", { name: "Outer Label" });
    expect(group).toContainElement(screen.getByText("body content"));
  });

  it("body always renders in headless mode regardless of open state", () => {
    render(
      <FieldSection node={groupNode} level="field" headless labelledBy="x" open={false}>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("Description is suppressed in headless mode", () => {
    const withDesc = { ...groupNode, description: "Some description." };
    render(
      <FieldSection node={withDesc} level="section" headless labelledBy="x">
        <FieldSection.Description />
      </FieldSection>
    );
    expect(screen.queryByText("Some description.")).toBeNull();
  });
});

describe("FieldSection — controlled mode", () => {
  it("respects open/onOpenChange when provided", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <FieldSection node={groupNode} level="field" open={false} onOpenChange={onOpenChange}>
        <FieldSection.Header>
          <FieldSection.Chevron />
        </FieldSection.Header>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    expect(screen.queryByText("body content")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Expand/ }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText("body content")).toBeNull();
    rerender(
      <FieldSection node={groupNode} level="field" open onOpenChange={onOpenChange}>
        <FieldSection.Header>
          <FieldSection.Chevron />
        </FieldSection.Header>
        <FieldSection.Body>
          <p>body content</p>
        </FieldSection.Body>
      </FieldSection>
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
  });
});
