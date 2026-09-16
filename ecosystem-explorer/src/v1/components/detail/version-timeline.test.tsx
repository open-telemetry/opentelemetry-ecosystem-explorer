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
import { describe, expect, it } from "vitest";

import {
  CompatibilityCard,
  DiffSelector,
  VersionTimeline,
  type VersionEntry,
} from "./version-timeline";

const VERSIONS: VersionEntry[] = [
  { version: "0.150.0", summary: "Latest release" },
  { version: "0.149.0" },
  { version: "0.148.0" },
];

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("VersionTimeline", () => {
  it("renders each version, its summary, and marks the current entry", () => {
    renderWithRouter(
      <VersionTimeline
        versions={VERSIONS}
        currentVersion="0.150.0"
        buildHref={(v) => `/base?version=${v}`}
      />
    );

    expect(screen.getByRole("link", { name: "0.150.0" })).toHaveAttribute(
      "href",
      "/base?version=0.150.0"
    );
    expect(screen.getByRole("link", { name: "0.149.0" })).toHaveAttribute(
      "href",
      "/base?version=0.149.0"
    );
    expect(screen.getByText("Latest release")).toBeInTheDocument();
    // The current version is flagged for assistive tech.
    expect(screen.getByRole("link", { name: "0.150.0" })).toHaveAttribute("aria-current", "true");
  });

  it("collapses to maxVisible and toggles the full list with the expand button", async () => {
    const user = userEvent.setup();
    const many: VersionEntry[] = Array.from({ length: 8 }, (_, i) => ({
      version: `0.1${40 + i}.0`,
    }));

    renderWithRouter(
      <VersionTimeline
        versions={many}
        currentVersion="0.147.0"
        buildHref={(v) => `/base?version=${v}`}
        maxVisible={6}
      />
    );

    expect(screen.getAllByRole("link")).toHaveLength(6);
    const toggle = screen.getByRole("button", { name: "Show all 8 versions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Show fewer" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("omits the expand button when versions fit within maxVisible", () => {
    renderWithRouter(
      <VersionTimeline
        versions={VERSIONS}
        currentVersion="0.150.0"
        buildHref={(v) => `/base?version=${v}`}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("DiffSelector", () => {
  it("returns null with fewer than two versions", () => {
    const { container } = renderWithRouter(
      <DiffSelector versions={["0.150.0"]} buildHref={(f, t) => `/diff?from=${f}&to=${t}`} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("builds the diff link from the selected from/to pair", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <DiffSelector
        versions={["0.150.0", "0.149.0", "0.148.0"]}
        defaultTo="0.150.0"
        buildHref={(f, t) => `/diff?from=${f}&to=${t}`}
      />
    );

    // Defaults: from = versions[1], to = defaultTo.
    expect(screen.getByRole("link", { name: /Diff/ })).toHaveAttribute(
      "href",
      "/diff?from=0.149.0&to=0.150.0"
    );

    // Each select is addressable by the label the user can actually see, so
    // voice control can name it. An aria-label would have replaced that name.
    await user.selectOptions(screen.getByRole("combobox", { name: "From" }), "0.148.0");

    expect(screen.getByRole("link", { name: /Diff/ })).toHaveAttribute(
      "href",
      "/diff?from=0.148.0&to=0.150.0"
    );
  });

  it("gives each select a unique id so two selectors can coexist on a page", () => {
    render(
      <MemoryRouter>
        <DiffSelector versions={["0.150.0", "0.149.0"]} buildHref={() => "/diff"} />
        <DiffSelector versions={["0.150.0", "0.149.0"]} buildHref={() => "/diff"} />
      </MemoryRouter>
    );

    const ids = screen.getAllByRole("combobox").map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("CompatibilityCard", () => {
  it("returns null when there are no distributions", () => {
    const { container } = render(<CompatibilityCard distributions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the distributions joined", () => {
    render(<CompatibilityCard distributions={["core", "contrib"]} />);
    expect(screen.getByRole("heading", { name: "Compatibility" })).toBeInTheDocument();
    expect(screen.getByText("core, contrib")).toBeInTheDocument();
  });
});
