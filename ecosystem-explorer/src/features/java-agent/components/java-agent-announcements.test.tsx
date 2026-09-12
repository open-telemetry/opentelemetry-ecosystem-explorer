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

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JavaAgentAnnouncements } from "./java-agent-announcements";
import { useJavaAgentAnnouncements } from "../hooks/use-java-agent-announcements";
import type { Announcement } from "../hooks/use-java-agent-announcements";

vi.mock("../hooks/use-java-agent-announcements", () => ({
  useJavaAgentAnnouncements: vi.fn(),
}));

const SKELETON_DELAY_MS = 300;

describe("JavaAgentAnnouncements", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing while a fast request is still loading", () => {
    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    const { container } = render(<JavaAgentAnnouncements />);

    // Below the delay threshold the placeholder must not paint at all — a skeleton that
    // appears and clears within a few frames reads as a flash.
    expect(container).toBeEmptyDOMElement();
  });

  it("reserves the section with a skeleton card once loading passes the delay", () => {
    vi.useFakeTimers();
    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    render(<JavaAgentAnnouncements />);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading announcements...");
    expect(screen.getAllByTestId("announcement-skeleton-card")).toHaveLength(1);
  });

  it("renders nothing when the announcements request fails", () => {
    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("failed to load announcements"),
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
    expect(screen.getByRole("region")).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    expect(screen.getByText("Test Announcement")).toBeInTheDocument();
    expect(screen.getByText("This is a test announcement body.")).toBeInTheDocument();
    expect(screen.getByText("Another Announcement")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/news");
    expect(links[0]).toHaveTextContent("Read more");
  });

  // The column count is the behavior being asserted here, so these tests do read the grid
  // classes — there is no semantic equivalent for "this card spans the container".
  it.each([
    { count: 1, expected: "grid-cols-1", notExpected: "md:grid-cols-2" },
    { count: 2, expected: "md:grid-cols-2", notExpected: "lg:grid-cols-3" },
    { count: 3, expected: "lg:grid-cols-3", notExpected: null },
  ])(
    "caps the grid at $count column(s) so $count card(s) fill the container",
    ({ count, expected, notExpected }) => {
      vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
        data: Array.from({ length: count }, (_, i) => ({
          id: String(i),
          date: "2026-07-20",
          title: `Announcement ${i}`,
          body: "Body",
        })),
        loading: false,
        error: null,
      });
      render(<JavaAgentAnnouncements />);

      const grid = screen.getByTestId("announcements-grid");
      expect(grid).toHaveClass(expected);
      if (notExpected) {
        expect(grid).not.toHaveClass(notExpected);
      }
    }
  );

  it("renders the loading skeleton at the same width as the single card it reserves", () => {
    vi.useFakeTimers();
    vi.mocked(useJavaAgentAnnouncements).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    render(<JavaAgentAnnouncements />);
    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });

    // One skeleton must span the container exactly as one real card will, or the
    // handoff from placeholder to content reintroduces a shift.
    expect(screen.getByTestId("announcements-grid")).toHaveClass("grid-cols-1");
    expect(screen.getByTestId("announcements-grid")).not.toHaveClass("md:grid-cols-2");
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
