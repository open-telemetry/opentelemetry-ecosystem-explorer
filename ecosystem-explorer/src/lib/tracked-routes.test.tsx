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
import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";

const setTrackedView = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ setTrackedView }));

import { TrackedRoutes } from "./tracked-routes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TrackedRoutes>
        <Route path="/" element={<p>home</p>} />
        <Route
          path="/collector/components/:distribution/:name"
          element={<p>detail</p>}
        />
        <Route path="*" element={<p>not found</p>} />
      </TrackedRoutes>
    </MemoryRouter>,
  );
}

describe("TrackedRoutes", () => {
  it("renders the matched route and names the view after its pattern", () => {
    renderAt("/collector/components/core/otlpreceiver");
    expect(screen.getByText("detail")).toBeInTheDocument();
    expect(setTrackedView).toHaveBeenLastCalledWith(
      "/collector/components/:distribution/:name",
    );
  });

  it("uses the splat pattern for unmatched paths", () => {
    renderAt("/does/not/exist");
    expect(screen.getByText("not found")).toBeInTheDocument();
    expect(setTrackedView).toHaveBeenLastCalledWith("*");
  });
});
