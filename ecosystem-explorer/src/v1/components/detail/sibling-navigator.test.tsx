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
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

import { OnPageAnchors, SiblingNavigator, type SiblingItem } from "./sibling-navigator";

const items: SiblingItem[] = [
  {
    id: "core-otlpreceiver",
    name: "otlpreceiver",
    displayName: "OTLP Receiver",
    href: "/collector/components/core/otlpreceiver",
  },
  {
    id: "contrib-kafkareceiver",
    name: "kafkareceiver",
    displayName: "Kafka Receiver",
    href: "/collector/components/contrib/kafkareceiver",
  },
];

function renderNav(activeId = "core-otlpreceiver") {
  return render(
    <MemoryRouter>
      <SiblingNavigator title="Receivers" items={items} activeId={activeId} />
    </MemoryRouter>
  );
}

describe("SiblingNavigator", () => {
  it("lists every sibling and marks the active one with aria-current", () => {
    renderNav();

    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    const active = screen.getByRole("link", { name: /OTLP Receiver/ });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Kafka Receiver/ })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("filters the list by name and shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderNav();

    const input = screen.getByRole("searchbox", { name: /filter receivers/i });
    await user.type(input, "kafka");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /OTLP Receiver/ })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "nomatch");
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });
});

describe("OnPageAnchors", () => {
  it("renders a labeled nav with one link per anchor", () => {
    render(
      <OnPageAnchors
        anchors={[
          { id: "placement", label: "Where this fits" },
          { id: "configuration", label: "Configuration" },
        ]}
        activeId="configuration"
      />
    );

    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Where this fits" })).toHaveAttribute(
      "href",
      "#placement"
    );
    expect(screen.getByRole("link", { name: "Configuration" })).toHaveAttribute(
      "href",
      "#configuration"
    );
  });

  it("renders tab-bound anchors as buttons that drive onSelectTab, not hash links", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(
      <OnPageAnchors
        anchors={[
          { id: "placement", label: "Where this fits" },
          { id: "attributes", label: "Emitted attributes", tab: "attributes" },
        ]}
        activeId="attributes"
        onSelectTab={onSelectTab}
      />
    );

    // Section anchors stay hash links; tab anchors are buttons (no hash write,
    // so no collision with the tab deep-link hash).
    expect(screen.getByRole("link", { name: "Where this fits" })).toHaveAttribute(
      "href",
      "#placement"
    );
    const tabButton = screen.getByRole("button", { name: "Emitted attributes" });
    expect(screen.queryByRole("link", { name: "Emitted attributes" })).not.toBeInTheDocument();

    await user.click(tabButton);
    expect(onSelectTab).toHaveBeenCalledWith("attributes");
  });

  it("renders nothing when there are no anchors", () => {
    const { container } = render(<OnPageAnchors anchors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
