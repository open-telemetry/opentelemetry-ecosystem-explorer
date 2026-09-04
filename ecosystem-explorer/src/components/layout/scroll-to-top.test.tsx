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
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "./scroll-to-top";

function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>back</button>;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/a"]}>
      <ScrollToTop />
      <Link to="/b">go b</Link>
      <Link to="/a?x=1">filter a</Link>
      <Back />
      <Routes>
        <Route path="/a" element={<p>page a</p>} />
        <Route path="/b" element={<p>page b</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ScrollToTop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrolls to the top on a pathname change, not on mount or query-only changes", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp();
    expect(scrollTo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "filter a" }));
    expect(scrollTo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "go b" }));
    expect(screen.getByText("page b")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("leaves back/forward navigation to the browser's scroll restoration", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("link", { name: "go b" }));
    expect(scrollTo).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "back" }));
    expect(screen.getByText("page a")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
