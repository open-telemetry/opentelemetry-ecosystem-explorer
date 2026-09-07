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

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { load } from "js-yaml";
import {
  acceptanceConfig,
  optionalScenario,
  waitForReady,
  clickTab,
  openCollectorFilters,
} from "./acceptance.mjs";

const workflow = load(
  readFileSync(resolve("../.github/workflows/screenshots-capture.yml"), "utf8")
);

describe("acceptance mode and scenario compatibility", () => {
  it.each(["feat/84-redesign", "fix/search", "main"])(
    "captures the v1 baseline on %s",
    (branch) => {
      const config = acceptanceConfig("legacy", {
        ...workflow.jobs.capture.env,
        HEAD_REF: branch,
        GITHUB_HEAD_REF: branch,
      });
      expect(config.appMode).toBe("v1");
      expect(optionalScenario(config, "collector-list-drawer")).toBeNull();
    }
  );

  it.each(["legacy", "v1"])("honors explicit %s mode independently of branch names", (appMode) => {
    expect(
      acceptanceConfig("v1", { ACCEPTANCE_APP_MODE: appMode, HEAD_REF: "fix/search" }).appMode
    ).toBe(appMode);
  });

  it("retains caller-specific compatibility defaults", () => {
    expect(acceptanceConfig("v1", {}).appMode).toBe("v1");
    expect(acceptanceConfig("legacy", {}).appMode).toBe("legacy");
  });

  it.each(["", "V1", "true", "unknown"])("rejects invalid mode %j", (appMode) => {
    expect(() => acceptanceConfig("v1", { ACCEPTANCE_APP_MODE: appMode })).toThrow(
      /ACCEPTANCE_APP_MODE.*legacy or v1/
    );
  });

  it.each(["take-screenshots.mjs", "generate-test-config.mjs"])(
    "%s rejects an invalid mode before serving or browsing",
    (script) => {
      const result = spawnSync(process.execPath, [resolve("scripts", script)], {
        env: { ...process.env, ACCEPTANCE_APP_MODE: "invalid" },
        encoding: "utf8",
        timeout: 10000,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Invalid ACCEPTANCE_APP_MODE "invalid"');
    }
  );

  it.each(["collector-list-cards", "collector-list-table", "collector-list-drawer"])(
    "classifies %s as v1-only",
    (scenario) => {
      expect(optionalScenario(acceptanceConfig("legacy", {}), scenario)).toBe(
        "requires the v1 Collector list"
      );
      expect(optionalScenario(acceptanceConfig("v1", {}), scenario)).toBeNull();
    }
  );

  it.each(["legacy", "v1"])(
    "requires enabled showcase in %s; skips only an explicit opt-out",
    (appMode) => {
      expect(optionalScenario(acceptanceConfig(appMode, {}), "dev-components")).toBeNull();
      expect(
        optionalScenario(
          acceptanceConfig(appMode, { ACCEPTANCE_DEV_SHOWCASE: "false" }),
          "dev-components"
        )
      ).toBe("ACCEPTANCE_DEV_SHOWCASE=false");
    }
  );

  it("rejects unclassified skips and invalid capability settings", () => {
    expect(() => optionalScenario(acceptanceConfig("v1", {}), "detail-telemetry")).toThrow(
      /no optional capability classification/
    );
    expect(() => acceptanceConfig("v1", { ACCEPTANCE_DEV_SHOWCASE: "maybe" })).toThrow(
      /must be true or false/
    );
  });

  it("fails when readiness times out instead of accepting partial content", async () => {
    const locator = { first: () => locator, waitFor: vi.fn(), count: () => 1 };
    const page = {
      url: () => "http://acceptance.test/collector/components",
      locator: () => locator,
      waitForLoadState: () => Promise.reject(new Error("network did not settle")),
    };
    await expect(
      waitForReady(
        page,
        { appMode: "v1", scenario: "collector-list", selector: ".td-list--compact a" },
        100
      )
    ).rejects.toThrow(
      /collector-list.*collector\/components.*required ready v1.*network did not settle/
    );
  });
});

// Opt-in real Chromium checks; the regular unit suite needs no browser install.
// ACCEPTANCE_BROWSER_TESTS=true NODE_OPTIONS=--no-experimental-webstorage \
//   bun run test scripts/acceptance.test.mjs --maxWorkers=2
// Uses intercepted fixture URLs, so it opens no dev-server port.
describe.runIf(process.env.ACCEPTANCE_BROWSER_TESTS === "true")(
  "acceptance required states in Chromium",
  () => {
    let browser;
    let page;
    beforeAll(async () => {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ headless: true });
    });
    afterEach(async () => {
      await page?.close();
    });
    afterAll(async () => {
      await browser?.close();
    });

    async function fixture(mode, content) {
      page = await browser.newPage();
      await page.route("http://acceptance.test/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<div id="root"><div class="${mode === "v1" ? "v1-app" : "legacy-app"}"><main>${content}</main></div></div>`,
        })
      );
      await page.goto("http://acceptance.test/detail");
    }

    it.each(["legacy", "v1"])(
      "accepts a loaded %s page and rejects the opposite mode",
      async (appMode) => {
        await fixture(appMode, '<h1>Detail</h1><div id="loaded">Ready</div>');
        await waitForReady(page, { appMode, scenario: "detail", selector: "#loaded" }, 1000);
        await expect(
          waitForReady(
            page,
            {
              appMode: appMode === "v1" ? "legacy" : "v1",
              scenario: "detail",
              selector: "#loaded",
            },
            100
          )
        ).rejects.toThrow(/Expected.*rendered.*VITE_FEATURE_FLAG_V1_REDESIGN/);
      }
    );

    it("rejects a visible heading whose required content never loaded", async () => {
      await fixture("v1", '<h1>Collector</h1><p role="status">Loading components</p>');
      await expect(
        waitForReady(
          page,
          { appMode: "v1", scenario: "collector-list", selector: ".td-list--compact a" },
          1000
        )
      ).rejects.toThrow(/collector-list.*required ready v1 page/);
    });

    it("rejects a rendered error page", async () => {
      await fixture("v1", "<h1>404 - Page Not Found</h1>");
      await expect(
        waitForReady(page, { appMode: "v1", scenario: "detail", selector: "h1" }, 1000)
      ).rejects.toThrow(/Error page: 404 - Page Not Found/);
    });

    it("accepts legitimate content headings containing error words", async () => {
      await fixture(
        "v1",
        '<h1>Error propagation receiver</h1><h2>Error handling</h2><div id="loaded">Ready</div>'
      );
      await waitForReady(page, { appMode: "v1", scenario: "detail", selector: "#loaded" }, 1000);
    });

    it("fails with the scenario, URL and tab name when Telemetry is absent", async () => {
      await fixture("v1", "<h1>Detail</h1>");
      await expect(clickTab(page, "Telemetry", "detail-telemetry", 100)).rejects.toThrow(
        /detail-telemetry.*http:\/\/acceptance.test\/detail.*required tab "Telemetry"/
      );
    });

    it("does not mistake a previously active panel for successful tab selection", async () => {
      await fixture(
        "v1",
        '<button role="tab" aria-selected="false">Telemetry</button><div role="tabpanel" aria-label="Details" data-state="active">Details</div>'
      );
      await expect(clickTab(page, "Telemetry", "detail-telemetry", 150)).rejects.toThrow(
        /required tab "Telemetry" selected/
      );
    });

    it("fails when the selected tab has no corresponding visible panel", async () => {
      await fixture(
        "v1",
        '<button role="tab" aria-selected="true">Telemetry</button><div role="tabpanel" aria-label="Details" data-state="active">Details</div>'
      );
      await expect(clickTab(page, "Telemetry", "detail-telemetry", 150)).rejects.toThrow(
        /required tab "Telemetry" selected with its visible panel/
      );
    });

    it("accepts a click only after its tab and panel become active", async () => {
      await fixture(
        "legacy",
        `<button role="tab" aria-selected="false" onclick="this.setAttribute('aria-selected', 'true');document.querySelector('[role=tabpanel]').hidden=false">Telemetry</button><div role="tabpanel" aria-label="Telemetry" hidden>Telemetry</div>`
      );
      await clickTab(page, "Telemetry", "detail-telemetry", 1000);
    });

    it("fails when the required v1 Open filters control is missing", async () => {
      await fixture("v1", "<h1>Collector components</h1>");
      await expect(openCollectorFilters(page, 100)).rejects.toThrow(
        /collector-list-drawer.*Open filters.*filter dialog/
      );
    });

    it("fails when Open filters never opens its dialog", async () => {
      await fixture("v1", "<button>Open filters</button>");
      await expect(openCollectorFilters(page, 150)).rejects.toThrow(
        /collector-list-drawer.*filter dialog/
      );
    });
  }
);
