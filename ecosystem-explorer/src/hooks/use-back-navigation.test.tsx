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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { BrowserRouter, Link, useLocation, useNavigate } from "react-router-dom";
import { getParentPath, useBackNavigation } from "./use-back-navigation";

function BackHarness({ fallbackTo }: { fallbackTo?: string }) {
  const goBack = useBackNavigation(fallbackTo);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <span data-testid="path">{location.pathname + location.search}</span>
      <Link to="/java-agent/releases">Releases</Link>
      <button onClick={() => navigate("/java-agent/releases?from=1&to=2", { replace: true })}>
        Rewrite URL
      </button>
      <button onClick={goBack}>Back</button>
    </>
  );
}

// Simulates opening `path` directly: a history entry without React Router state.
function openDirectly(path: string, fallbackTo?: string) {
  window.history.replaceState(null, "", path);
  render(
    <BrowserRouter>
      <BackHarness fallbackTo={fallbackTo} />
    </BrowserRouter>
  );
}

const currentPath = () => screen.getByTestId("path").textContent;

describe("getParentPath", () => {
  it("drops the last segment", () => {
    expect(getParentPath("/java-agent/releases")).toBe("/java-agent");
  });

  it("returns the root for top-level paths", () => {
    expect(getParentPath("/about")).toBe("/");
    expect(getParentPath("/")).toBe("/");
  });

  it("ignores a trailing slash", () => {
    expect(getParentPath("/java-agent/releases/")).toBe("/java-agent");
  });
});

describe("useBackNavigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("goes to the parent path when the page was opened directly", () => {
    openDirectly("/java-agent/releases");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(currentPath()).toBe("/java-agent");
  });

  it("goes to fallbackTo when the page was opened directly", () => {
    openDirectly("/collector/components/contrib/kafka", "/collector/components");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(currentPath()).toBe("/collector/components");
  });

  it("stays in the app when a directly opened page rewrites its URL", () => {
    openDirectly("/java-agent/releases");
    fireEvent.click(screen.getByRole("button", { name: "Rewrite URL" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(currentPath()).toBe("/java-agent");
  });

  it("keeps going up on consecutive clicks after a direct visit", () => {
    openDirectly("/java-agent/releases");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(currentPath()).toBe("/java-agent");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(currentPath()).toBe("/");
  });

  it("goes back in history after in-app navigation", async () => {
    openDirectly("/java-agent/instrumentation");
    fireEvent.click(screen.getByRole("link", { name: "Releases" }));
    expect(currentPath()).toBe("/java-agent/releases");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(currentPath()).toBe("/java-agent/instrumentation"));
  });
});
