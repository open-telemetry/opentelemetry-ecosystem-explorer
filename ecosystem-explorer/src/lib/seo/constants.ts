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

/**
 * Shared SEO constants. This module is intentionally dependency-free so it can
 * be imported from three runtimes: the Bun build script (`scripts/generate-seo.mjs`),
 * the Vite/React client (`<Seo>` component), and the Netlify Deno edge function.
 * Keep it free of framework/runtime-specific imports.
 */

/** Canonical production origin. All absolute URLs (sitemap, canonical, og:url) use this. */
export const SITE_ORIGIN = "https://explorer.opentelemetry.io";

/** Human-facing site name, used for og:site_name and title suffixes. */
export const SITE_NAME = "OpenTelemetry Ecosystem Explorer";

/** Default social preview image (absolute URL). Mirrors public/og-default.png. */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.png`;

/** Global fallback title, matching the static <title> in index.html. */
export const DEFAULT_TITLE = SITE_NAME;

/** Global fallback description, matching the static meta description in index.html. */
export const DEFAULT_DESCRIPTION =
  "Search and explore the OpenTelemetry ecosystem: Collector components and Java agent " +
  "instrumentations, with telemetry, configuration, and version details.";
