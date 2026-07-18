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
 * Java Agent landing config. Copy fields (eyebrow, lead, CTA labels, pipeline
 * title/lead, stage label/description, quick-entry title/description) hold
 * i18next KEYS, not literal English — `EcosystemPage` resolves them via
 * `useTranslation("java-agent")` against the `landingV1.*` block. The hero
 * `title` stays JSX because it carries the gradient-accent span.
 *
 * Category counts are runtime-loaded by `useEcosystemLandingData`, derived per
 * tile from its own `?search=` term so a count equals what clicking it lands
 * on; the static values here are the documented offline/fallback baseline.
 * Java Agent records carry no stability field, so the release card has no
 * deltas (version-only). The pipeline renders as a no-flow grid of categories.
 */

import { Box, GitCompare, Layers } from "lucide-react";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import { JavaIcon } from "@/components/icons/java-icon";
import type { EcosystemConfig } from "./types";

const javaInstrumentationPath = "/java-agent/instrumentation";

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
      // The count is a substring match on "framework" — some instrumentations
      // covering a framework do so via an underlying component (e.g. HTTP client
      // library) and may not mention "framework" directly, so the live count is
      // an approximation. Trade-off accepted in the Phase 3 design (count =
      // destination, so the number always matches what clicking the tile lands on).
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
    {
      id: "releases",
      title: "landingV1.quickEntries.releases.title",
      description: "landingV1.quickEntries.releases.description",
      href: "/java-agent/releases",
      icon: <GitCompare className="h-5 w-5" aria-hidden />,
    },
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
    // No release date until the watcher captures git tag dates (follow-up). Java
    // Agent records carry no stability field, so deltas stay null in both the
    // live and fallback states — the card is version-only, never a delta strip.
    releaseDate: null,
    deltas: null,
    hrefChangelog: "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases",
  },
};
