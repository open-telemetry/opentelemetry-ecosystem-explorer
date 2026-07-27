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
import { describe, expect, it, vi } from "vitest";
import { JavaAgentAnnouncements } from "./java-agent-announcements";
import { useJavaAgentAnnouncements } from "../hooks/use-java-agent-announcements";
import type { Announcement } from "../hooks/use-java-agent-announcements";

vi.mock("../hooks/use-java-agent-announcements", () => ({
  useJavaAgentAnnouncements: vi.fn(),
}));

describe("JavaAgentAnnouncements", () => {
  it("renders nothing when loading", () => {
    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    const { container } = render(<JavaAgentAnnouncements />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when data is empty", () => {
    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    });
    const { container } = render(<JavaAgentAnnouncements />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders announcements when data is present", () => {
    const mockAnnouncements: Announcement[] = [
      {
        id: "1",
        date: "2026-07-20",
        title: "Test Announcement",
        body: "This is a test announcement body.",
        link: "https://example.com/news",
      },
      {
        id: "2",
        date: "2026-07-21",
        title: "Another Announcement",
        body: "No link for this one.",
      },
    ];

    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: mockAnnouncements,
      loading: false,
      error: null,
    });
    render(<JavaAgentAnnouncements />);

    expect(screen.getByRole("heading", { name: "News & Announcements" })).toBeInTheDocument();

    expect(screen.getByText("Test Announcement")).toBeInTheDocument();
    expect(screen.getByText("This is a test announcement body.")).toBeInTheDocument();
    expect(screen.getByText("Another Announcement")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/news");
    expect(links[0]).toHaveTextContent("Read more");
  });

  it("does not render link anchor when scheme is unsafe (e.g. javascript:)", () => {
    const mockAnnouncements: Announcement[] = [
      {
        id: "1",
        date: "2026-07-20",
        title: "Test Announcement",
        body: "This is a test announcement body.",
        link: "javascript:alert('XSS')",
      },
    ];

    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: mockAnnouncements,
      loading: false,
      error: null,
    });
    render(<JavaAgentAnnouncements />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
