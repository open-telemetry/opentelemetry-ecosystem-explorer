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
import { faro } from "@grafana/faro-react";

const MAX_ATTRIBUTE_LENGTH = 100;

const BOT_USER_AGENT = /HeadlessChrome|bot|crawl|spider|slurp|lighthouse/i;

/** Heuristic only: headless crawlers that spoof a desktop UA and clear webdriver slip through. */
export function isLikelyBot(
  nav: Pick<Navigator, "webdriver" | "userAgent"> = navigator,
): boolean {
  return nav.webdriver === true || BOT_USER_AGENT.test(nav.userAgent);
}

/**
 * Pushes a Faro event. `faro.api` is undefined until `initializeFaro` runs, which only happens
 * when `VITE_FARO_URL` is set, so this is a no-op in dev, previews, and tests.
 */
export function trackEvent(
  name: string,
  attributes?: Record<string, string>,
): void {
  if (!faro.api) return;
  const capped = attributes
    ? Object.fromEntries(
        Object.entries(attributes).map(([k, v]) => [
          k,
          v.slice(0, MAX_ATTRIBUTE_LENGTH),
        ]),
      )
    : undefined;
  faro.api.pushEvent(name, capped);
}

export function setTrackedView(name: string): void {
  faro.api?.setView({ name });
}

/** Reports clicks on links that leave the site. One listener covers every external anchor. */
export function registerOutboundClickTracking(doc: Document = document): void {
  doc.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      let url: URL;
      try {
        url = new URL(anchor.href, doc.location.href);
      } catch {
        return;
      }
      if (!url.protocol.startsWith("http") || url.host === doc.location.host)
        return;
      trackEvent("outbound_click", {
        href: url.href,
        host: url.host,
        path: doc.location.pathname,
      });
    },
    { capture: true },
  );
}
