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
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vite-plus/test";
import { BrowserRouter } from "react-router-dom";
import { JavaAgentPage } from "./java-agent-page";
import * as javaagentData from "@/lib/api/javaagent-data";
import type { Announcement } from "./hooks/use-java-agent-announcements";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadVersions: vi.fn(),
  loadAllInstrumentations: vi.fn(),
}));

const announcements: Announcement[] = [
  { id: "news", date: "2026-07-20", title: "Agent news", body: "A new release." },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderPage() {
  return render(
    <BrowserRouter>
      <JavaAgentPage />
    </BrowserRouter>
  );
}

function expectNavigation() {
  expect(screen.getByRole("link", { name: /Instrumentation Libraries/i })).toBeInTheDocument();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(javaagentData.loadVersions).mockResolvedValue({
    versions: [{ version: "2.30.0", is_latest: true }],
  });
  vi.mocked(javaagentData.loadAllInstrumentations).mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => announcements }));
});

describe("JavaAgentPage", () => {
  it("keeps the title and back button available during loading", () => {
    vi.mocked(javaagentData.loadVersions).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("OpenTelemetry Java Agent");
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("link", { name: /Instrumentation Libraries/i })
    ).not.toBeInTheDocument();
  });

  it("waits for slow announcements before revealing all sections together", async () => {
    const response = deferred<Response>();
    vi.mocked(fetch).mockReturnValue(response.promise);
    renderPage();
    await waitFor(() => expect(javaagentData.loadAllInstrumentations).toHaveBeenCalledOnce());
    expect(screen.queryByText("v2.30.0")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await act(async () => response.resolve(new Response(JSON.stringify(announcements))));
    expect(screen.getByText("v2.30.0")).toBeInTheDocument();
    expect(screen.getByText("Agent news")).toBeInTheDocument();
    expectNavigation();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
    expect(javaagentData.loadVersions).toHaveBeenCalledOnce();
  });

  it("waits for a slow summary even when announcements finish first", async () => {
    const instrumentations =
      deferred<Awaited<ReturnType<typeof javaagentData.loadAllInstrumentations>>>();
    vi.mocked(javaagentData.loadAllInstrumentations).mockReturnValue(instrumentations.promise);
    renderPage();
    await waitFor(() => expect(javaagentData.loadAllInstrumentations).toHaveBeenCalledOnce());
    expect(screen.queryByText("Agent news")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await act(async () => instrumentations.resolve([]));
    expect(screen.getByText("Agent news")).toBeInTheDocument();
    expect(screen.getByText("v2.30.0")).toBeInTheDocument();
    expectNavigation();
  });

  it.each(["network", "http", "json", "empty"])(
    "reveals the page after %s announcements",
    async (failure) => {
      if (failure === "network") vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
      if (failure === "http")
        vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
      if (failure === "json") vi.mocked(fetch).mockResolvedValue(new Response("invalid json"));
      if (failure === "empty") vi.mocked(fetch).mockResolvedValue(new Response("[]"));
      renderPage();
      expect(await screen.findByText("v2.30.0")).toBeInTheDocument();
      expectNavigation();
      expect(screen.queryByText("News & Announcements")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    }
  );

  it("shows the summary error alongside the loaded sections", async () => {
    vi.mocked(javaagentData.loadVersions).mockRejectedValue(new Error("Summary unavailable"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Summary unavailable");
    expect(screen.getByText("Agent news")).toBeInTheDocument();
    expectNavigation();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
