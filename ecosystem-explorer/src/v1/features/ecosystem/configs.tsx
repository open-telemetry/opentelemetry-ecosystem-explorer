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
 * Counts and version strings are pulled from the 2026-05-13 mockup;
 * wiring to live data via `loadAllComponents` / `loadAllInstrumentations`
 * is a follow-up tracked in the decision log.
 */

import { ArrowLeftRight, Box, GitCompare, Layers } from "lucide-react";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import { OtelLogo } from "@/components/icons/otel-logo";
import { JavaIcon } from "@/components/icons/java-icon";
import { filtersToHref } from "@/v1/lib/list-filters";
import type { EcosystemConfig } from "./types";

const collectorComponentsPath = "/collector/components";
const javaInstrumentationPath = "/java-agent/instrumentation";

export const collectorConfig: EcosystemConfig = {
  name: "OpenTelemetry Collector",
  hero: {
    eyebrow: "Infrastructure · Vendor-agnostic agent",
    title: (
      <>
        OpenTelemetry <span className="td-cover-block__title-accent">Collector</span>
      </>
    ),
    lead: "Receive, process, and export telemetry data. A vendor-agnostic agent for ingesting, processing, and exporting metrics, traces, and logs.",
    ctas: [
      { label: "Browse components", href: collectorComponentsPath, primary: true },
      {
        label: "Read overview",
        href: "https://opentelemetry.io/docs/collector/",
        external: true,
      },
      {
        label: "GitHub",
        href: "https://github.com/open-telemetry/opentelemetry-collector",
        external: true,
      },
    ],
    logo: <OtelLogo className="td-cover-block__logo" />,
  },
  pipelineTitle: "Pipeline anatomy",
  pipelineLead:
    "A Collector pipeline is composed of receivers, processors, exporters, connectors, and extensions. Click any stage to filter the components list.",
  stages: [
    {
      id: "receiver",
      label: "Receivers",
      count: "98",
      description: "Ingest data from sources",
      href: filtersToHref(collectorComponentsPath, { types: ["receiver"] }),
      accentColor: TYPE_STRIPE_COLORS.receiver,
    },
    {
      id: "processor",
      label: "Processors",
      count: "28",
      description: "Transform & enrich data",
      href: filtersToHref(collectorComponentsPath, { types: ["processor"] }),
      accentColor: TYPE_STRIPE_COLORS.processor,
    },
    {
      id: "exporter",
      label: "Exporters",
      count: "47",
      description: "Send data to backends",
      href: filtersToHref(collectorComponentsPath, { types: ["exporter"] }),
      accentColor: TYPE_STRIPE_COLORS.exporter,
    },
    {
      id: "connector",
      label: "Connectors",
      count: "9",
      description: "Bridge between pipelines",
      href: filtersToHref(collectorComponentsPath, { types: ["connector"] }),
      accentColor: TYPE_STRIPE_COLORS.connector,
    },
    {
      id: "extension",
      label: "Extensions",
      count: "18",
      description: "Auxiliary capabilities",
      href: filtersToHref(collectorComponentsPath, { types: ["extension"] }),
      accentColor: TYPE_STRIPE_COLORS.extension,
    },
  ],
  quickEntries: [
    {
      id: "most-used",
      title: "Most-used components",
      description: "Receivers, processors, and exporters most commonly deployed.",
      href: filtersToHref(collectorComponentsPath, { sort: "updated" }),
      icon: <Layers className="h-5 w-5" aria-hidden />,
    },
    {
      id: "core-vs-contrib",
      title: "Core vs. Contrib",
      description: "Compare the core distribution against the contrib add-ons.",
      href: filtersToHref(collectorComponentsPath, { distributions: ["core", "contrib"] }),
      icon: <ArrowLeftRight className="h-5 w-5" aria-hidden />,
    },
    {
      id: "diff",
      title: "Diff across versions",
      description: "See what changed between two Collector releases.",
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
  name: "OpenTelemetry Java Agent",
  hero: {
    eyebrow: "Auto-instrumentation · JVM",
    title: (
      <>
        OpenTelemetry <span className="td-cover-block__title-accent">Java Agent</span>
      </>
    ),
    lead: "Zero-code auto-instrumentation for Java applications. Hundreds of supported libraries and frameworks; configurable via system properties or env vars.",
    ctas: [
      { label: "Browse instrumentations", href: javaInstrumentationPath, primary: true },
      {
        label: "Read overview",
        href: "https://opentelemetry.io/docs/zero-code/java/agent/",
        external: true,
      },
      {
        label: "GitHub",
        href: "https://github.com/open-telemetry/opentelemetry-java-instrumentation",
        external: true,
      },
    ],
    logo: <JavaIcon className="td-cover-block__logo" />,
  },
  pipelineTitle: "Instrumentation categories",
  pipelineLead:
    "Java auto-instrumentations are grouped by category. Click any category to filter the instrumentation list.",
  pipelineNoFlow: true,
  stages: [
    {
      id: "http",
      label: "HTTP",
      count: "32",
      description: "Servers & clients",
      href: `${javaInstrumentationPath}?search=http`,
      accentColor: TYPE_STRIPE_COLORS.receiver,
    },
    {
      id: "db",
      label: "Databases",
      count: "41",
      description: "JDBC, NoSQL, ORM",
      href: `${javaInstrumentationPath}?search=db`,
      accentColor: TYPE_STRIPE_COLORS.processor,
    },
    {
      id: "messaging",
      label: "Messaging",
      count: "21",
      description: "Brokers & queues",
      href: `${javaInstrumentationPath}?search=messaging`,
      accentColor: TYPE_STRIPE_COLORS.exporter,
    },
    {
      id: "frameworks",
      label: "Frameworks",
      count: "55",
      description: "Spring, Quarkus, …",
      href: `${javaInstrumentationPath}?search=framework`,
      accentColor: TYPE_STRIPE_COLORS.connector,
    },
    {
      id: "runtime",
      label: "Runtime",
      count: "12",
      description: "JVM, threads, GC",
      href: `${javaInstrumentationPath}?search=runtime`,
      accentColor: TYPE_STRIPE_COLORS.extension,
    },
  ],
  quickEntries: [
    {
      id: "config-builder",
      title: "Configuration builder",
      description: "Build a declarative agent configuration interactively.",
      href: "/java-agent/configuration/builder",
      icon: <Box className="h-5 w-5" aria-hidden />,
    },
    {
      id: "releases",
      title: "Compare releases",
      description: "See what's new between two Java Agent versions.",
      href: "/java-agent/releases",
      icon: <GitCompare className="h-5 w-5" aria-hidden />,
    },
    {
      id: "supported-libs",
      title: "Supported libraries",
      description: "Browse the complete catalog of supported libraries and frameworks.",
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
