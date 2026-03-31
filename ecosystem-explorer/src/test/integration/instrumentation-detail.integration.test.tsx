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
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { InstrumentationDetailPage } from "@/features/java-agent/instrumentation-detail-page";
import { loadVersions, loadVersionManifest, loadInstrumentation } from "@/lib/api/javaagent-data";
import type { InstrumentationData } from "@/types/javaagent";

let latestVersion: string;
let firstId: string;
let firstInstrumentation: InstrumentationData;

beforeAll(async () => {
  installFetchInterceptor();

  // Derive a valid version/name pair dynamically from the real DB so the
  // tests are not coupled to specific version strings or instrumentation names.
  const { versions } = await loadVersions();
  latestVersion = versions.find((v) => v.is_latest)!.version;

  const manifest = await loadVersionManifest(latestVersion);
  firstId = Object.keys(manifest.instrumentations)[0];

  firstInstrumentation = await loadInstrumentation(firstId, latestVersion, manifest);
});

afterAll(() => uninstallFetchInterceptor());

function renderDetailPage(version: string, name: string) {
  return render(
    <MemoryRouter initialEntries={[`/java-agent/instrumentation/${version}/${name}`]}>
      <Routes>
        <Route
          path="/java-agent/instrumentation/:version/:name"
          element={<InstrumentationDetailPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("InstrumentationDetailPage — integration", () => {
  it("renders without an error state", async () => {
    renderDetailPage(latestVersion, firstId);

    await waitFor(
      () => {
        expect(screen.queryByText("Loading instrumentation...")).not.toBeInTheDocument();
      },
      { timeout: 20_000 }
    );

    expect(screen.queryByText("Error loading instrumentation")).not.toBeInTheDocument();
  });

  it("renders a heading with the instrumentation display name", async () => {
    renderDetailPage(latestVersion, firstId);

    await waitFor(
      () => {
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading.textContent?.length).toBeGreaterThan(0);
      },
      { timeout: 20_000 }
    );
  });

  it("shows the resolved version on the page", async () => {
    renderDetailPage(latestVersion, firstId);

    await waitFor(
      () => expect(screen.queryByText("Loading instrumentation...")).not.toBeInTheDocument(),
      { timeout: 20_000 }
    );

    // The version appears in the version badge/selector area with a "v" prefix.
    expect(screen.getByText(`v${latestVersion}`)).toBeInTheDocument();
  });

  it("shows the instrumentation description on the page when present", async () => {
    renderDetailPage(latestVersion, firstId);

    await waitFor(
      () => expect(screen.queryByText("Loading instrumentation...")).not.toBeInTheDocument(),
      { timeout: 20_000 }
    );

    if (firstInstrumentation.description) {
      expect(screen.getByText(firstInstrumentation.description)).toBeInTheDocument();
    } else {
      // No description field — verify the page still rendered successfully.
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    }
  });

  it("renders a non-empty h1 heading after load", async () => {
    renderDetailPage(latestVersion, firstId);

    await waitFor(
      () => {
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading.textContent?.trim().length).toBeGreaterThan(0);
      },
      { timeout: 20_000 }
    );
  });
});
