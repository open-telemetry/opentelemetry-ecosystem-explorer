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
 * Pure, dependency-free derivation of per-route SEO metadata (title +
 * description) and canonical paths. Shared across three runtimes — the Bun
 * build generator, the Vite/React client `<Seo>` component, and the Netlify
 * Deno edge function — so all three emit identical text for a given URL. Do
 * not import framework or Node/Deno APIs here.
 */

import { SITE_NAME } from "./constants";

export interface SeoMeta {
  title: string;
  description: string;
}

/** Minimal shape of a Collector component record (from data/collector/index.json). */
export interface CollectorComponentLike {
  id: string;
  name: string;
  distribution: string;
  display_name?: string | null;
  description?: string | null;
  type?: string | null;
  stability?: string | null;
}

/** Minimal shape of a Java instrumentation record (from data/javaagent/index.json). */
export interface InstrumentationLike {
  name: string;
  display_name?: string | null;
  description?: string | null;
}

const MAX_DESCRIPTION = 160;

/**
 * Normalizes free-form text (which may contain markdown or HTML) into a plain,
 * single-line description clamped to a search-friendly length (~160 chars) at a
 * word boundary. Returns "" for empty/whitespace input.
 */
export function clampDescription(input: string | null | undefined, max = MAX_DESCRIPTION): string {
  if (!input) return "";
  const plain = input
    .replace(/<[^>]*>/g, " ") // strip HTML tags
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links/images -> text
    .replace(/[*_`#>~]/g, "") // markdown emphasis/heading/code/quote markers
    .replace(/\s+/g, " ") // collapse whitespace/newlines
    .trim();

  if (plain.length <= max) return plain;
  // Clamp at the last word boundary before `max`, then add an ellipsis.
  const clipped = plain.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}…`;
}

/** Canonical, version-less detail path for a Collector component. */
export function collectorDetailPath(
  component: Pick<CollectorComponentLike, "distribution" | "name">
): string {
  return `/collector/components/${component.distribution}/${component.name}`;
}

/** Canonical, version-less detail path for a Java instrumentation. */
export function instrumentationDetailPath(
  instrumentation: Pick<InstrumentationLike, "name">
): string {
  return `/java-agent/instrumentation/${instrumentation.name}`;
}

/** SEO title + description for a Collector component detail page. */
export function deriveCollectorMeta(component: CollectorComponentLike): SeoMeta {
  const label = component.display_name || component.name;
  const title = `${label} — OpenTelemetry Collector`;
  const description = component.description
    ? clampDescription(component.description)
    : clampDescription(
        `${label} is a ${component.type ?? "component"} in the OpenTelemetry Collector ${
          component.distribution
        } distribution${component.stability ? ` (${component.stability})` : ""}.`
      );
  return { title, description };
}

/** SEO title + description for a Java instrumentation detail page. */
export function deriveInstrumentationMeta(instrumentation: InstrumentationLike): SeoMeta {
  const label = instrumentation.display_name || instrumentation.name;
  const title = `${label} — OpenTelemetry Java Agent`;
  const description = instrumentation.description
    ? clampDescription(instrumentation.description)
    : clampDescription(`${label} auto-instrumentation for the OpenTelemetry Java agent.`);
  return { title, description };
}

/**
 * SEO metadata for the fixed (non-parameterized) routes, keyed by canonical
 * pathname. English-only single source shared by the generator, client, and
 * edge — see the AGENTS.md i18n note; SEO strings are deliberately not routed
 * through i18next (localized SEO/URLs are out of scope).
 */
export const STATIC_ROUTE_META: Record<string, SeoMeta> = {
  "/": {
    title: SITE_NAME,
    description:
      "Search and explore the OpenTelemetry ecosystem: Collector components and Java agent " +
      "instrumentations, with telemetry, configuration, and version details.",
  },
  "/about": {
    title: `About — ${SITE_NAME}`,
    description:
      "About the OpenTelemetry Ecosystem Explorer: how it surfaces Collector and Java agent " +
      "metadata sourced from the OpenTelemetry project.",
  },
  "/collector": {
    title: "OpenTelemetry Collector — Ecosystem Explorer",
    description:
      "Explore the OpenTelemetry Collector: browse receivers, processors, exporters, and " +
      "connectors across distributions and versions.",
  },
  "/collector/components": {
    title: "Collector Components — OpenTelemetry Ecosystem Explorer",
    description:
      "Browse and search all OpenTelemetry Collector components — receivers, processors, " +
      "exporters, and connectors — by distribution, type, and stability.",
  },
  "/java-agent": {
    title: "OpenTelemetry Java Agent — Ecosystem Explorer",
    description:
      "Explore OpenTelemetry Java agent auto-instrumentation: supported libraries, emitted " +
      "telemetry, and configuration options.",
  },
  "/java-agent/instrumentation": {
    title: "Java Agent Instrumentations — OpenTelemetry Ecosystem Explorer",
    description:
      "Browse and search all OpenTelemetry Java agent instrumentations, their emitted telemetry, " +
      "and supported library versions.",
  },
  "/java-agent/configuration": {
    title: "Java Agent Configuration — OpenTelemetry Ecosystem Explorer",
    description:
      "Browse OpenTelemetry Java agent configuration options across instrumentations and versions.",
  },
  "/java-agent/configuration/builder": {
    title: "Java Agent Configuration Builder — OpenTelemetry Ecosystem Explorer",
    description:
      "Build an OpenTelemetry Java agent configuration interactively and export it for your " +
      "application.",
  },
  "/java-agent/releases": {
    title: "Java Agent Release Comparison — OpenTelemetry Ecosystem Explorer",
    description:
      "Compare OpenTelemetry Java agent releases to see which instrumentations and telemetry " +
      "changed between versions.",
  },
};
