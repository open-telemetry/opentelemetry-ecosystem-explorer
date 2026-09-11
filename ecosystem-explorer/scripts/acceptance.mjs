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

// Compatibility defaults belong to the caller: v1 screenshots match the main
// baseline; legacy YAML generation matches the nightly SDK build. Neither uses
// branch names. ACCEPTANCE_APP_MODE explicitly overrides either default.
export function acceptanceConfig(defaultMode, env = process.env) {
  const appMode = env.ACCEPTANCE_APP_MODE ?? defaultMode;
  if (!["legacy", "v1"].includes(appMode)) {
    throw new Error(`Invalid ACCEPTANCE_APP_MODE "${appMode}"; expected legacy or v1`);
  }
  const showcase = env.ACCEPTANCE_DEV_SHOWCASE ?? "true";
  if (!["true", "false"].includes(showcase)) {
    throw new Error("ACCEPTANCE_DEV_SHOWCASE must be true or false");
  }
  return { appMode, devShowcase: showcase === "true" };
}

// Only these scenarios are conditional. When enabled, their controls and ready
// states are required; a missing element never turns into an implicit skip.
export function optionalScenario(config, name) {
  switch (name) {
    case "collector-list-cards":
    case "collector-list-table":
    case "collector-list-drawer":
      return config.appMode === "v1" ? null : "requires the v1 Collector list";
    case "dev-components":
      return config.devShowcase ? null : "ACCEPTANCE_DEV_SHOWCASE=false";
    default:
      throw new Error(`Scenario "${name}" has no optional capability classification`);
  }
}

/** Required states carry their scenario and URL into failures in both acceptance scripts. */
export async function requireState(page, scenario, description, action) {
  try {
    return await action();
  } catch (cause) {
    throw new Error(
      `Acceptance scenario "${scenario}" at ${page.url()}: required ${description}. ${cause.message}`,
      { cause }
    );
  }
}

export async function waitForReady(page, { appMode, scenario, selector }, timeout = 10000) {
  await requireState(page, scenario, `ready ${appMode} page (${selector})`, async () => {
    await page.locator("main").first().waitFor({ state: "visible", timeout });
    const renderedMode = (await page.locator("#root > .v1-app").count()) > 0 ? "v1" : "legacy";
    if (renderedMode !== appMode) {
      throw new Error(
        `Expected ${appMode} app, rendered ${renderedMode}; rebuild with ` +
          `VITE_FEATURE_FLAG_V1_REDESIGN=${appMode === "v1"} and set ACCEPTANCE_APP_MODE=${appMode}`
      );
    }
    await page.waitForLoadState("networkidle", { timeout });
    // Exact route failure copy avoids rejecting legitimate headings such as
    // "Error handling" in documentation or the component showcase.
    const errorHeading = page
      .locator("main")
      .first()
      .getByRole("heading", {
        name: /^(404 - Page Not Found|Something went wrong|Error loading (data|component|instrumentation|versions)|Version not found)$/,
      });
    if (await errorHeading.first().isVisible()) {
      throw new Error(`Error page: ${await errorHeading.first().textContent()}`);
    }
    await page.locator(selector).first().waitFor({ state: "visible", timeout });
  });
}

export async function clickTab(page, name, scenario, timeout = 5000) {
  await requireState(page, scenario, `tab "${name}" selected with its visible panel`, async () => {
    await page.getByRole("tab", { name, exact: true }).click({ timeout });
    await page.getByRole("tab", { name, exact: true, selected: true }).waitFor({
      state: "visible",
      timeout,
    });
    // Match the requested panel by its accessible name, not any previously active panel.
    await page.getByRole("tabpanel", { name, exact: true }).waitFor({ state: "visible", timeout });
    await page.waitForLoadState("networkidle", { timeout });
  });
}

export async function openCollectorFilters(page, timeout = 5000) {
  await requireState(
    page,
    "collector-list-drawer",
    '"Open filters" button and filter dialog',
    async () => {
      await page.getByRole("button", { name: /open filters/i }).click({ timeout });
      await page.getByRole("dialog", { name: /filters/i }).waitFor({ state: "visible", timeout });
    }
  );
}
