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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import schemaVersionsIndex from "../../../public/data/configuration/versions-index.json";
import javaAgentVersionsIndex from "../../../public/data/javaagent/versions-index.json";
import { normalizeRegistryName } from "@/lib/normalize-instrumentation";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";

const latestSchemaVersion = schemaVersionsIndex.versions.find((v) => v.is_latest)!.version;
const latestAgentVersion = javaAgentVersionsIndex.versions.find((v) => v.is_latest)!.version;
const otherAgentVersion = javaAgentVersionsIndex.versions.find((v) => !v.is_latest)?.version;

const MANIFESTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/data/javaagent/versions"
);

function moduleNamesFor(version: string): Set<string> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(MANIFESTS_DIR, `${version}-index.json`), "utf-8")
  ) as { instrumentations: Record<string, string> };
  return new Set(Object.keys(manifest.instrumentations).map(normalizeRegistryName));
}

// Pick a module present in the latest agent version but absent in `otherAgentVersion`,
// so the prune test exercises the actual code path regardless of which versions ship.
const moduleOnlyInLatest = (() => {
  if (!otherAgentVersion) return undefined;
  const latest = moduleNamesFor(latestAgentVersion);
  const other = moduleNamesFor(otherAgentVersion);
  return [...latest].find((m) => !other.has(m));
})();

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());
beforeEach(() => localStorage.clear());

async function findAgentSelector(): Promise<HTMLSelectElement> {
  return (await screen.findByLabelText("Agent", {}, { timeout: 10_000 })) as HTMLSelectElement;
}

async function openInstrumentationTab(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });
  const sidebar = screen.getByRole("complementary");
  await user.click(within(sidebar).getByRole("tab", { name: /Instrumentation/i }));
}

describe("ConfigurationBuilderPage version selectors", () => {
  it("renders Schema and Agent selectors side by side in the page header", async () => {
    renderPage();
    const schema = (await screen.findByLabelText(
      "Schema",
      {},
      { timeout: 10_000 }
    )) as HTMLSelectElement;
    const agent = await findAgentSelector();
    expect(schema.value).toBe(latestSchemaVersion);
    expect(agent.value).toBe(latestAgentVersion);
  });

  it("re-runs the registry lookup and updates the Instrumentation tab when the Agent version changes", async () => {
    if (!otherAgentVersion) return;
    renderPage();
    const user = userEvent.setup();
    const agent = await findAgentSelector();

    await openInstrumentationTab(user);
    await screen.findByTestId("instrumentation-row-reactor", {}, { timeout: 10_000 });
    const preview = (await screen.findByLabelText(
      "Output Preview",
      {},
      { timeout: 10_000 }
    )) as HTMLElement;
    expect(preview.textContent).toContain(`Java agent: ${latestAgentVersion}`);

    await user.selectOptions(agent, otherAgentVersion);

    await waitFor(
      () => {
        expect(preview.textContent).toContain(`Java agent: ${otherAgentVersion}`);
      },
      { timeout: 10_000 }
    );
    expect(preview.textContent).not.toContain(`Java agent: ${latestAgentVersion}`);
    await screen.findByTestId("instrumentation-row-reactor", {}, { timeout: 10_000 });
  });

  it("updates the YAML preview header from the SDK tab when the Agent version changes", async () => {
    if (!otherAgentVersion) return;
    renderPage();
    const user = userEvent.setup();
    const preview = (await screen.findByLabelText(
      "Output Preview",
      {},
      { timeout: 10_000 }
    )) as HTMLElement;
    expect(preview.textContent).toContain(`Java agent: ${latestAgentVersion}`);

    const agent = await findAgentSelector();
    await user.selectOptions(agent, otherAgentVersion);

    await waitFor(() => {
      expect(preview.textContent).toContain(`Java agent: ${otherAgentVersion}`);
    });
    expect(preview.textContent).not.toContain(`Java agent: ${latestAgentVersion}`);
  });

  it("preserves user-entered configuration values when the Agent version changes", async () => {
    if (!otherAgentVersion) return;
    renderPage();
    const user = userEvent.setup();
    const resourceToggle = await screen.findByRole(
      "switch",
      { name: /Enable Resource/i },
      { timeout: 10_000 }
    );
    expect(resourceToggle).toHaveAttribute("aria-checked", "true");
    await user.click(resourceToggle);
    await waitFor(() => expect(resourceToggle).toHaveAttribute("aria-checked", "false"));

    const agent = await findAgentSelector();
    await user.selectOptions(agent, otherAgentVersion);

    expect(resourceToggle).toHaveAttribute("aria-checked", "false");
  });

  it("prunes instrumentation customizations referencing modules absent from the selected Agent version", async () => {
    if (!otherAgentVersion || !moduleOnlyInLatest) return;
    const orphan = moduleOnlyInLatest;
    const orphanLineRe = new RegExp(`- ${orphan}\\b`);
    renderPage();
    const user = userEvent.setup();
    const agent = await findAgentSelector();

    await openInstrumentationTab(user);
    const row = (await screen.findByTestId(
      `instrumentation-row-${orphan}`,
      {},
      { timeout: 10_000 }
    )) as HTMLElement;
    const customize = within(row).getByRole("button", {
      name: new RegExp(`Customize ${orphan}`, "i"),
    });
    await user.click(customize);
    const preview = (await screen.findByLabelText(
      "Output Preview",
      {},
      { timeout: 10_000 }
    )) as HTMLElement;
    await waitFor(() => expect(preview.textContent).toMatch(orphanLineRe));

    await user.selectOptions(agent, otherAgentVersion);

    await waitFor(
      () => {
        expect(preview.textContent).toContain(`Java agent: ${otherAgentVersion}`);
        expect(preview.textContent).not.toMatch(orphanLineRe);
        expect(preview.textContent).not.toMatch(/^distribution:/m);
      },
      { timeout: 10_000 }
    );
  });

  it("does not persist the Agent selection: remount resets to latest with empty localStorage", async () => {
    if (!otherAgentVersion) return;
    const { unmount } = renderPage();
    const user = userEvent.setup();
    const agent = await findAgentSelector();
    await user.selectOptions(agent, otherAgentVersion);
    expect(agent.value).toBe(otherAgentVersion);

    unmount();
    expect(localStorage.length).toBe(0);

    renderPage();
    const reloaded = await findAgentSelector();
    expect(reloaded.value).toBe(latestAgentVersion);
  });
});
