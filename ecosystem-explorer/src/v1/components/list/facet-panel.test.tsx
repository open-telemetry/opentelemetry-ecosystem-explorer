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
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FILTERS,
  type ListFilters,
  parseFilters,
  serializeFilters,
} from "@/v1/lib/list-filters";
import { FacetPanel } from "@/v1/components/list/facet-panel";

function mockViewport(initialWidth: number) {
  let width = initialWidth;
  const matches = (query: string, viewport: number) =>
    query === "(min-width: 992px)" ? viewport >= 992 : viewport < 992;
  const queries: { media: MediaQueryList; events: EventTarget }[] = [];
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const events = new EventTarget();
    const media: MediaQueryList = {
      media: query,
      get matches() {
        return matches(query, width);
      },
      onchange: null,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    queries.push({ media, events });
    return media;
  });
  return (nextWidth: number) => {
    const changed = queries.filter(
      ({ media }) => media.matches !== matches(media.media, nextWidth)
    );
    width = nextWidth;
    act(() => changed.forEach(({ events }) => events.dispatchEvent(new Event("change"))));
  };
}

// The real caller writes URL filters and creates a new onClose on every render.
function UrlDrawer() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const filters = parseFilters(params);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open drawer
      </button>
      <output aria-label="URL filters">{params.toString()}</output>
      <FacetPanel
        filters={filters}
        onChange={(next) => setParams(serializeFilters({ ...filters, ...next }))}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const renderPanel = (props: Partial<Parameters<typeof FacetPanel>[0]> = {}) =>
  render(<FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} {...props} />);

describe("FacetPanel", () => {
  let resize: ReturnType<typeof mockViewport>;
  beforeEach(() => {
    resize = mockViewport(390);
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the filters rail with the search facet and one group per checkbox facet", () => {
    renderPanel();

    expect(screen.getByRole("complementary", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search" })).toBeInTheDocument();
    for (const title of ["Type", "Signal", "Stability", "Distribution"]) {
      expect(screen.getByRole("group", { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: "Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close filters" })).not.toBeInTheDocument();
  });

  it("renders the version select when versions are provided", () => {
    renderPanel({ versions: ["v0.150.0", "v0.149.0"] });

    expect(screen.getByRole("combobox", { name: "Version" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Latest" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "v0.150.0" })).toBeInTheDocument();
  });

  it("reflects the incoming filters on the facet controls", () => {
    const filters: ListFilters = {
      ...DEFAULT_FILTERS,
      signals: ["traces"],
      version: "v0.149.0",
    };
    renderPanel({ filters, versions: ["v0.150.0", "v0.149.0"] });

    expect(screen.getByRole("checkbox", { name: /traces/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /metrics/i })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveValue("v0.149.0");
  });

  it("surfaces facet counts next to the matching options", () => {
    renderPanel({ counts: { types: { receiver: 98 }, distributions: { core: 41 } } });

    expect(screen.getByText("98")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
  });

  it("emits the toggled facet and resets to page 1", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPanel({ filters: { ...DEFAULT_FILTERS, page: 3 }, onChange });

    await user.click(screen.getByRole("checkbox", { name: /receiver/i }));
    expect(onChange).toHaveBeenCalledWith({ types: ["receiver"], page: 1 });
  });

  it("keeps checkbox focus when URL filters change with a new close callback", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UrlDrawer />
      </MemoryRouter>
    );
    const opener = screen.getByRole("button", { name: "open drawer" });
    await user.click(opener);
    const receiver = screen.getByRole("checkbox", { name: /receiver/i });
    await user.click(receiver);

    expect(screen.getByLabelText("URL filters")).toHaveTextContent("type=receiver");
    expect(receiver).toBeChecked();
    expect(receiver).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps search focus after its debounce updates URL filters", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <UrlDrawer />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "open drawer" }));
    const search = screen.getByRole("searchbox", { name: "Search" });
    search.focus();
    fireEvent.change(search, { target: { value: "otlp" } });
    act(() => vi.advanceTimersByTime(250));

    expect(screen.getByLabelText("URL filters")).toHaveTextContent("q=otlp");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("otlp");
  });

  it("releases modal semantics, focus trapping and scroll lock at 992px", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderPanel({ isOpen: true, onClose });
    const receiver = screen.getByRole("checkbox", { name: /receiver/i });
    await user.click(receiver);
    resize(992);

    expect(screen.getByRole("complementary", { name: "Filters" })).not.toHaveAttribute(
      "aria-modal"
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelector(".td-facet-panel__scrim")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(receiver).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    const last = screen.getByRole("checkbox", { name: /contrib/i });
    last.focus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("resumes the requested drawer across repeated viewport crossings and restores its original opener", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <MemoryRouter>
          <UrlDrawer />
        </MemoryRouter>
      </StrictMode>
    );
    const opener = screen.getByRole("button", { name: "open drawer" });
    await user.click(opener);

    for (const desktopWidth of [992, 1280]) {
      const receiver = screen.getByRole("checkbox", { name: /receiver/i });
      await user.click(receiver);
      opener.hidden = true;
      resize(desktopWidth);
      expect(receiver).toHaveFocus();
      expect(screen.getByRole("complementary", { name: "Filters" })).not.toHaveAttribute(
        "aria-modal"
      );
      expect(document.body.style.overflow).toBe("");

      opener.hidden = false;
      resize(991.5);
      expect(screen.getByRole("dialog", { name: "Filters" })).toHaveAttribute("aria-modal", "true");
      expect(screen.getByRole("button", { name: "Close filters" })).toHaveFocus();
      expect(document.body.style.overflow).toBe("hidden");
    }

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(opener).toHaveFocus();
    expect(opener).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("moves focus into the desktop rail when the browser blurs the hidden Close button", () => {
    renderPanel({ isOpen: true, onClose: vi.fn() });
    const close = screen.getByRole("button", { name: "Close filters" });
    expect(close).toHaveFocus();
    // Chromium blurs the control as soon as the desktop CSS hides it, before
    // React handles the media-query change. jsdom does not apply that CSS.
    close.blur();
    resize(992);
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Close filters" })).not.toBeInTheDocument();
  });

  it("keeps a closed rail nonmodal when resizing from desktop to mobile", () => {
    resize(1280);
    const onClose = vi.fn();
    renderPanel({ onClose });
    resize(991);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses the latest close callback without moving the focused filter", () => {
    const previousClose = vi.fn();
    const nextClose = vi.fn();
    const { rerender } = renderPanel({ isOpen: true, onClose: previousClose });
    const receiver = screen.getByRole("checkbox", { name: /receiver/i });
    receiver.focus();
    rerender(
      <FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} isOpen onClose={nextClose} />
    );
    expect(receiver).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(previousClose).not.toHaveBeenCalled();
    expect(nextClose).toHaveBeenCalledOnce();
  });

  it("leaves initial desktop rendering nonmodal even when the drawer is requested open", () => {
    resize(1280);
    const onClose = vi.fn();
    renderPanel({ isOpen: true, onClose });
    expect(screen.getByRole("complementary", { name: "Filters" })).not.toHaveAttribute(
      "aria-modal"
    );
    expect(document.body.style.overflow).toBe("");
    expect(document.body).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("emits the version and resets to page 1 when the select changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onChange, versions: ["v0.150.0", "v0.149.0"] });

    await user.selectOptions(screen.getByRole("combobox", { name: "Version" }), "v0.149.0");
    expect(onChange).toHaveBeenCalledWith({ version: "v0.149.0", page: 1 });
  });

  it("emits the debounced query and resets to page 1", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    renderPanel({ onChange });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "otlp" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ q: "otlp", page: 1 });
  });

  it("fires onClose from the drawer close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel({ isOpen: true, onClose });

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes the open drawer on Escape", () => {
    const onClose = vi.fn();
    renderPanel({ isOpen: true, onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores Escape while the drawer is closed", () => {
    const onClose = vi.fn();
    renderPanel({ isOpen: false, onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders dialog semantics only while open as a drawer", () => {
    const { rerender } = render(
      <FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} isOpen={false} onClose={vi.fn()} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus into the drawer on open and returns it to the opener on close", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open drawer
          </button>
          <FacetPanel
            filters={DEFAULT_FILTERS}
            onChange={vi.fn()}
            isOpen={open}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "open drawer" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("button", { name: "Close filters" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(opener).toHaveFocus();
  });

  it("locks body scroll while the drawer is open and restores it on close", () => {
    document.body.style.overflow = "auto";
    const { rerender } = render(
      <FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} isOpen onClose={vi.fn()} />
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <FacetPanel filters={DEFAULT_FILTERS} onChange={vi.fn()} isOpen={false} onClose={vi.fn()} />
    );
    expect(document.body.style.overflow).toBe("auto");
  });

  it("restores scroll and opener focus when the open drawer unmounts", () => {
    document.body.style.overflow = "scroll";
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = renderPanel({ isOpen: true, onClose });
    expect(document.body.style.overflow).toBe("hidden");
    unmount();

    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("scroll");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    opener.remove();
  });

  it("closes the drawer when the scrim is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderPanel({ isOpen: true, onClose });

    const scrim = container.querySelector(".td-facet-panel__scrim");
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("wraps Tab focus within the open drawer", async () => {
    const user = userEvent.setup();
    renderPanel({ isOpen: true, onClose: vi.fn(), versions: ["v0.150.0"] });
    const first = screen.getByRole("button", { name: "Close filters" });
    const last = screen.getByRole("combobox", { name: "Version" });

    last.focus();
    await user.tab();
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });
});
