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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mockFaro = vi.hoisted(() => ({
  api: undefined as
    | undefined
    | {
        pushEvent: ReturnType<typeof vi.fn>;
        setView: ReturnType<typeof vi.fn>;
      },
}));
vi.mock("@grafana/faro-react", () => ({ faro: mockFaro }));

import {
  isLikelyBot,
  registerOutboundClickTracking,
  setTrackedView,
  trackEvent,
} from "./telemetry";

describe("isLikelyBot", () => {
  const chrome =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

  it("is false for a regular browser", () => {
    expect(isLikelyBot({ webdriver: false, userAgent: chrome })).toBe(false);
  });

  it("is true when navigator.webdriver is set", () => {
    expect(isLikelyBot({ webdriver: true, userAgent: chrome })).toBe(true);
  });

  it.each([
    "HeadlessChrome/130.0.0.0",
    "Googlebot/2.1",
    "AhrefsBot",
    "Chrome-Lighthouse",
  ])("is true for crawler user agent %s", (ua) => {
    expect(isLikelyBot({ webdriver: false, userAgent: ua })).toBe(true);
  });
});

describe("trackEvent / setTrackedView", () => {
  afterEach(() => {
    mockFaro.api = undefined;
  });

  it("is a no-op when Faro is not initialized", () => {
    expect(() => trackEvent("search", { query: "redis" })).not.toThrow();
    expect(() => setTrackedView("/collector")).not.toThrow();
  });

  it("pushes the event with attributes capped at 100 chars", () => {
    mockFaro.api = { pushEvent: vi.fn(), setView: vi.fn() };
    trackEvent("search", { query: "x".repeat(150), source: "home" });
    expect(mockFaro.api.pushEvent).toHaveBeenCalledWith("search", {
      query: "x".repeat(100),
      source: "home",
    });
  });

  it("sets the view by name", () => {
    mockFaro.api = { pushEvent: vi.fn(), setView: vi.fn() };
    setTrackedView("/collector/components/:distribution/:name");
    expect(mockFaro.api.setView).toHaveBeenCalledWith({
      name: "/collector/components/:distribution/:name",
    });
  });
});

describe("registerOutboundClickTracking", () => {
  beforeEach(() => {
    mockFaro.api = { pushEvent: vi.fn(), setView: vi.fn() };
    document.body.innerHTML = `
      <a id="external" href="https://github.com/open-telemetry"><span id="inner">GitHub</span></a>
      <a id="internal" href="/collector">Collector</a>
    `;
  });

  afterEach(() => {
    mockFaro.api = undefined;
    document.body.innerHTML = "";
  });

  // Registered once: the listener lives for the document's lifetime, as in production.
  registerOutboundClickTracking();

  function click(id: string) {
    const el = document.getElementById(id)!;
    // Prevent jsdom from attempting navigation.
    el.closest("a")!.addEventListener("click", (e) => e.preventDefault(), {
      once: true,
    });
    el.click();
  }

  it("tracks clicks on external links, including on nested elements", () => {
    click("inner");
    expect(mockFaro.api!.pushEvent).toHaveBeenCalledWith("outbound_click", {
      href: "https://github.com/open-telemetry",
      host: "github.com",
      path: window.location.pathname,
    });
  });

  it("ignores same-host links", () => {
    click("internal");
    expect(mockFaro.api!.pushEvent).not.toHaveBeenCalled();
  });
});
