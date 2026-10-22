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
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  useJavaAgentAnnouncements,
  type Announcement,
} from "@/features/java-agent/hooks/use-java-agent-announcements";
import { AnnouncementsSection } from "./announcements-section";

vi.mock("@/features/java-agent/hooks/use-java-agent-announcements", () => ({
  useJavaAgentAnnouncements: vi.fn(),
}));

const SKELETON_DELAY_MS = 300;

const copy = {
  heading: "News & Announcements",
  loadingLabel: "Loading announcements...",
  readMoreLabel: "Read more",
};

function mockAnnouncements(state: {
  data: Announcement[] | null;
  loading: boolean;
  error?: Error | null;
}) {
  vi.mocked(useJavaAgentAnnouncements).mockReturnValue({ error: null, ...state });
}

function renderSection() {
  return render(<AnnouncementsSection {...copy} />);
}

const withLink: Announcement = {
  id: "1",
  date: "2026-09-12",
  title: "Welcome to the Java Agent Explorer",
  body: "Announcements are now shown on the landing page.",
  link: "https://example.com/news",
};

describe("AnnouncementsSection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(useJavaAgentAnnouncements).mockReset();
  });

  it("renders nothing while a fast request is still loading", () => {
    mockAnnouncements({ data: null, loading: true });
    const { container } = renderSection();
    // A skeleton that paints and clears within a few frames reads as a flash.
    expect(container).toBeEmptyDOMElement();
  });

  it("reserves the section with one skeleton card once loading passes the delay", () => {
    vi.useFakeTimers();
    mockAnnouncements({ data: null, loading: true });
    const { container } = renderSection();

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });

    expect(screen.getByRole("heading", { level: 2, name: copy.heading })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: copy.heading })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(copy.loadingLabel);
    expect(container.querySelectorAll(".td-home__skeleton")).toHaveLength(1);
  });

  it("renders nothing when the request fails, without an alert", () => {
    mockAnnouncements({ data: null, loading: false, error: new Error("boom") });
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no announcements", () => {
    mockAnnouncements({ data: [], loading: false });
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each announcement as a card with a localised date", () => {
    mockAnnouncements({
      data: [withLink, { id: "2", date: "2026-09-13", title: "No link", body: "Plain news." }],
      loading: false,
    });
    renderSection();

    const section = screen.getByRole("region", { name: copy.heading });
    expect(section).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: copy.heading })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Welcome to the Java Agent Explorer",
      "No link",
    ]);
    expect(screen.getByText("Plain news.")).toBeInTheDocument();

    const time = screen.getByText("September 12, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-09-12");
  });

  it("falls back to the raw value when the date is not parseable", () => {
    mockAnnouncements({ data: [{ ...withLink, date: "soon" }], loading: false });
    renderSection();
    expect(screen.getByText("soon")).toHaveAttribute("datetime", "soon");
  });

  it("opens a safe link in a new tab and says so to screen readers", () => {
    mockAnnouncements({ data: [withLink], loading: false });
    renderSection();

    const link = screen.getByRole("link", { name: /Read more/ });
    expect(link).toHaveAttribute("href", "https://example.com/news");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    // Several cards repeat "Read more", so the name carries the card title and ends with the hint.
    expect(link).toHaveAccessibleName(
      "Read more: Welcome to the Java Agent Explorer (opens in a new tab)"
    );
  });

  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>", "not a url"])(
    "renders no link for the unsafe or invalid URL %s",
    (url) => {
      mockAnnouncements({ data: [{ ...withLink, link: url }], loading: false });
      renderSection();
      expect(screen.getByText(withLink.title)).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    }
  );

  it("formats the date and the new-tab hint in the active language", async () => {
    const ecosystemEs = await import("../../../../public/locales/es/ecosystem.json");
    i18n.addResourceBundle("es", "ecosystem", ecosystemEs.default, true, true);
    await i18n.changeLanguage("es");

    try {
      mockAnnouncements({ data: [withLink], loading: false });
      renderSection();
      expect(screen.getByText("12 de septiembre de 2026")).toBeInTheDocument();
      expect(screen.getByRole("link")).toHaveAccessibleName(/\(se abre en una pestaña nueva\)$/);
    } finally {
      await i18n.changeLanguage("en");
    }
  });
});
