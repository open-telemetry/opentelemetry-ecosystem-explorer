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

/*
 * Per-ecosystem configs that drive the ecosystem landing pages. New
 * ecosystems get a new entry here plus a one-line route swap in
 * `V1App.tsx`.
 *
 * Copy fields (eyebrow, lead, CTA labels, pipeline title/lead, stage
 * label/description, quick-entry title/description) hold i18next KEYS, not
 * literal English. `EcosystemPage` resolves them via `useTranslation(config.id)`
 * — each per-ecosystem string lives in the `collector` / `java-agent`
 * namespace under `landingV1.*`. The hero `title` stays as JSX because it
 * carries the gradient-accent span.
 *
 * Pipeline/category counts and the release block are runtime-loaded by
 * `useEcosystemLandingData`; the static values here are the documented
 * offline/fallback baseline.
 */

import { ArrowLeftRight, Box, GitCompare, Layers } from "lucide-react";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import { OtelLogo } from "@/components/icons/otel-logo";
import { JavaIcon } from "@/components/icons/java-icon";
import { isEnabled } from "@/lib/feature-flags";
import { filtersToHref } from "@/v1/lib/list-filters";
import type { EcosystemConfig } from "./types";

const collectorComponentsPath = "/collector/components";
const javaInstrumentationPath = "/java-agent/instrumentation";

export const collectorConfig: EcosystemConfig = {
  id: "collector",
  name: "OpenTelemetry Collector",
  hero: {
    eyebrow: "landingV1.hero.eyebrow",
    title: (
      <>
        OpenTelemetry <span className="td-cover-block__title-accent">Collector</span>
      </>
    ),
    lead: "landingV1.hero.lead",
    ctas: [
      { label: "landingV1.hero.cta.browse", href: collectorComponentsPath, primary: true },
      {
        label: "landingV1.hero.cta.overview",
        href: "https://opentelemetry.io/docs/collector/",
        external: true,
      },
      {
        label: "landingV1.hero.cta.github",
        href: "https://github.com/open-telemetry/opentelemetry-collector",
        external: true,
      },
    ],
    logo: <OtelLogo className="td-cover-block__logo" />,
  },
  pipelineTitle: "landingV1.pipeline.title",
  pipelineLead: "landingV1.pipeline.lead",
  stages: [
    {
      id: "receiver",
      label: "landingV1.stages.receiver.label",
      count: "98",
      description: "landingV1.stages.receiver.description",
      href: filtersToHref(collectorComponentsPath, { types: ["receiver"] }),
      accentColor: TYPE_STRIPE_COLORS.receiver,
    },
    {
      id: "processor",
      label: "landingV1.stages.processor.label",
      count: "28",
      description: "landingV1.stages.processor.description",
      href: filtersToHref(collectorComponentsPath, { types: ["processor"] }),
      accentColor: TYPE_STRIPE_COLORS.processor,
    },
    {
      id: "exporter",
      label: "landingV1.stages.exporter.label",
      count: "47",
      description: "landingV1.stages.exporter.description",
      href: filtersToHref(collectorComponentsPath, { types: ["exporter"] }),
      accentColor: TYPE_STRIPE_COLORS.exporter,
    },
    {
      id: "connector",
      label: "landingV1.stages.connector.label",
      count: "9",
      description: "landingV1.stages.connector.description",
      href: filtersToHref(collectorComponentsPath, { types: ["connector"] }),
      accentColor: TYPE_STRIPE_COLORS.connector,
    },
    {
      id: "extension",
      label: "landingV1.stages.extension.label",
      count: "18",
      description: "landingV1.stages.extension.description",
      href: filtersToHref(collectorComponentsPath, { types: ["extension"] }),
      accentColor: TYPE_STRIPE_COLORS.extension,
    },
  ],
  quickEntries: [
    {
      id: "most-used",
      title: "landingV1.quickEntries.most-used.title",
      description: "landingV1.quickEntries.most-used.description",
      href: filtersToHref(collectorComponentsPath, { sort: "updated" }),
      icon: <Layers className="h-5 w-5" aria-hidden />,
    },
    {
      id: "core-vs-contrib",
      title: "landingV1.quickEntries.core-vs-contrib.title",
      description: "landingV1.quickEntries.core-vs-contrib.description",
      href: filtersToHref(collectorComponentsPath, { distributions: ["core", "contrib"] }),
      icon: <ArrowLeftRight className="h-5 w-5" aria-hidden />,
    },
    {
      id: "diff",
      title: "landingV1.quickEntries.diff.title",
      description: "landingV1.quickEntries.diff.description",
      href: filtersToHref(collectorComponentsPath, { sort: "updated" }),
      icon: <GitCompare className="h-5 w-5" aria-hidden />,
    },
  ],
  release: {
    version: "v0.150.0",
    releaseDate: "May 2026",
    deltas: { added: 4, changed: 12, deprecated: 2 },
    hrefChangelog: "https://github.com/open-telemetry/opentelemetry-collector-releases/releases",
  },
};

export const javaAgentConfig: EcosystemConfig = {
  id: "java-agent",
  name: "OpenTelemetry Java Agent",
  hero: {
    eyebrow: "landingV1.hero.eyebrow",
    title: (
      <>
        OpenTelemetry <span className="td-cover-block__title-accent">Java Agent</span>
      </>
    ),
    lead: "landingV1.hero.lead",
    ctas: [
      { label: "landingV1.hero.cta.browse", href: javaInstrumentationPath, primary: true },
      {
        label: "landingV1.hero.cta.overview",
        href: "https://opentelemetry.io/docs/zero-code/java/agent/",
        external: true,
      },
      {
        label: "landingV1.hero.cta.github",
        href: "https://github.com/open-telemetry/opentelemetry-java-instrumentation",
        external: true,
      },
    ],
    logo: <JavaIcon className="td-cover-block__logo" />,
  },
  pipelineTitle: "landingV1.pipeline.title",
  pipelineLead: "landingV1.pipeline.lead",
  pipelineNoFlow: true,
  stages: [
    {
      id: "http",
      label: "landingV1.stages.http.label",
      count: "32",
      description: "landingV1.stages.http.description",
      href: `${javaInstrumentationPath}?search=http`,
      accentColor: TYPE_STRIPE_COLORS.receiver,
    },
    {
      id: "db",
      label: "landingV1.stages.db.label",
      count: "41",
      description: "landingV1.stages.db.description",
      href: `${javaInstrumentationPath}?search=db`,
      accentColor: TYPE_STRIPE_COLORS.processor,
    },
    {
      id: "messaging",
      label: "landingV1.stages.messaging.label",
      count: "21",
      description: "landingV1.stages.messaging.description",
      href: `${javaInstrumentationPath}?search=messaging`,
      accentColor: TYPE_STRIPE_COLORS.exporter,
    },
    {
      id: "frameworks",
      label: "landingV1.stages.frameworks.label",
      count: "55",
      description: "landingV1.stages.frameworks.description",
      href: `${javaInstrumentationPath}?search=framework`,
      accentColor: TYPE_STRIPE_COLORS.connector,
    },
    {
      id: "runtime",
      label: "landingV1.stages.runtime.label",
      count: "12",
      description: "landingV1.stages.runtime.description",
      href: `${javaInstrumentationPath}?search=runtime`,
      accentColor: TYPE_STRIPE_COLORS.extension,
    },
  ],
  quickEntries: [
    {
      id: "config-builder",
      title: "landingV1.quickEntries.config-builder.title",
      description: "landingV1.quickEntries.config-builder.description",
      href: "/java-agent/configuration/builder",
      icon: <Box className="h-5 w-5" aria-hidden />,
    },
    // Only surface the release-comparison entry when its route is mounted —
    // `/java-agent/releases` is gated behind JAVA_RELEASE_COMPARISON in V1App,
    // so without this guard the card would 404 wherever the flag is off.
    ...(isEnabled("JAVA_RELEASE_COMPARISON")
      ? [
          {
            id: "releases",
            title: "landingV1.quickEntries.releases.title",
            description: "landingV1.quickEntries.releases.description",
            href: "/java-agent/releases",
            icon: <GitCompare className="h-5 w-5" aria-hidden />,
          },
        ]
      : []),
    {
      id: "supported-libs",
      title: "landingV1.quickEntries.supported-libs.title",
      description: "landingV1.quickEntries.supported-libs.description",
      href: javaInstrumentationPath,
      icon: <Layers className="h-5 w-5" aria-hidden />,
    },
  ],
  release: {
    version: "v2.10.0",
    releaseDate: "May 2026",
    deltas: { added: 3, changed: 9, deprecated: 1 },
    hrefChangelog: "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases",
  },
};
