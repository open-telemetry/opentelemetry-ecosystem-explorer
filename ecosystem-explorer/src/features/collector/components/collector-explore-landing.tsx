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
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Box,
  ExternalLink,
  Layers,
  Loader2,
  Plug,
  Send,
  Workflow,
} from "lucide-react";

import { loadVersions } from "@/lib/api/collector-data";

const COMPONENT_TYPES = [
  {
    type: "receiver",
    label: "Receiver",
    description:
      "Collect telemetry data from various sources including OTLP, Prometheus, Jaeger, and many others",
    icon: Box,
  },
  {
    type: "processor",
    label: "Processor",
    description: "Transform, filter, batch, and enrich telemetry data before export",
    icon: Layers,
  },
  {
    type: "exporter",
    label: "Exporter",
    description: "Send telemetry data to observability backends and storage systems",
    icon: Send,
  },
  {
    type: "extension",
    label: "Extension",
    description: "Provide additional capabilities like health checks, profiling, and authentication",
    icon: Plug,
  },
  {
    type: "connector",
    label: "Connector",
    description: "Connect multiple pipelines and enable data flow between signal types",
    icon: Workflow,
  },
] as const;

const DISTRIBUTIONS = [
  {
    distribution: "core",
    label: "Core",
    description:
      "Officially maintained components with stable APIs. Minimal dependencies, production-ready.",
    buttonLabel: "View Core Components",
  },
  {
    distribution: "contrib",
    label: "Contrib",
    description:
      "Community-contributed components. May have varying stability levels. Broader ecosystem coverage.",
    buttonLabel: "View Contrib Components",
  },
] as const;

const RESOURCES = [
  {
    label: "Official Documentation",
    href: "https://opentelemetry.io/docs/collector/",
  },
  {
    label: "Getting Started Guide",
    href: "https://opentelemetry.io/docs/collector/getting-started/",
  },
  {
    label: "Configuration Reference",
    href: "https://opentelemetry.io/docs/collector/configuration/",
  },
  {
    label: "GitHub (Core)",
    href: "https://github.com/open-telemetry/opentelemetry-collector",
  },
  {
    label: "GitHub (Contrib)",
    href: "https://github.com/open-telemetry/opentelemetry-collector-contrib",
  },
] as const;

type CollectorComponentType = (typeof COMPONENT_TYPES)[number]["type"];
type CollectorDistribution = (typeof DISTRIBUTIONS)[number]["distribution"];

interface CollectorIndexComponent {
  id: string;
  name: string;
  display_name?: string | null;
  description?: string | null;
  distribution: CollectorDistribution;
  type: CollectorComponentType;
  stability?: string | null;
}

interface CollectorLandingStats {
  byDistribution: Record<CollectorDistribution, number>;
  byType: Record<CollectorComponentType, number>;
  latestVersion: string | null;
  total: number;
}

type CollectorLandingState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; stats: CollectorLandingStats };

function emptyTypeCounts(): Record<CollectorComponentType, number> {
  return {
    receiver: 0,
    processor: 0,
    exporter: 0,
    extension: 0,
    connector: 0,
  };
}

function emptyDistributionCounts(): Record<CollectorDistribution, number> {
  return {
    core: 0,
    contrib: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComponentType(value: unknown): value is CollectorComponentType {
  return typeof value === "string" && COMPONENT_TYPES.some(({ type }) => type === value);
}

function isDistribution(value: unknown): value is CollectorDistribution {
  return (
    typeof value === "string" &&
    DISTRIBUTIONS.some(({ distribution }) => distribution === value)
  );
}

function isCollectorIndexComponent(value: unknown): value is CollectorIndexComponent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isComponentType(value.type) &&
    isDistribution(value.distribution)
  );
}

function readCollectorComponents(payload: unknown): CollectorIndexComponent[] {
  const componentEntries = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.components)
      ? payload.components
      : null;

  if (!componentEntries) {
    throw new Error("Collector index did not include a components array.");
  }

  return componentEntries.map((entry) => {
    if (!isCollectorIndexComponent(entry)) {
      throw new Error("Collector index contains an invalid component entry.");
    }
    return entry;
  });
}

async function loadCollectorLandingStats(): Promise<CollectorLandingStats> {
  const [indexResponse, versionData] = await Promise.all([
    fetch("/data/collector/index.json"),
    loadVersions(),
  ]);

  if (!indexResponse.ok) {
    throw new Error(`Collector index request failed with ${indexResponse.status}.`);
  }

  const payload: unknown = await indexResponse.json();
  const components = readCollectorComponents(payload);
  const byType = emptyTypeCounts();
  const byDistribution = emptyDistributionCounts();

  for (const component of components) {
    byType[component.type] += 1;
    byDistribution[component.distribution] += 1;
  }

  return {
    byDistribution,
    byType,
    latestVersion:
      versionData.versions.find((version) => version.is_latest)?.version ??
      versionData.versions[0]?.version ??
      null,
    total: components.length,
  };
}

export function CollectorExploreLanding() {
  const [state, setState] = useState<CollectorLandingState>({ status: "loading" });
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const stats = await loadCollectorLandingStats();
        if (!cancelled) {
          setState({ status: "ready", stats });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section
        aria-live="polite"
        className="border-border/60 bg-card/80 flex min-h-72 flex-col items-center justify-center rounded-lg border p-8 text-center"
      >
        <Loader2 className="text-primary h-10 w-10 animate-spin" aria-hidden="true" />
        <p className="text-muted-foreground mt-4 text-sm font-medium">
          Loading Collector ecosystem data...
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        role="alert"
        className="border-border/60 bg-card/80 flex min-h-72 flex-col items-center justify-center rounded-lg border p-8 text-center"
      >
        <AlertCircle className="text-primary h-10 w-10" aria-hidden="true" />
        <h2 className="text-foreground mt-4 text-lg font-semibold">Error loading Collector data</h2>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm">{state.error.message}</p>
      </section>
    );
  }

  const { stats } = state;

  return (
    <section className="bg-background relative px-0 py-2">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="border-border/60 bg-card/80 rounded-lg border p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl space-y-3">
              <h2 className="text-foreground text-2xl font-bold md:text-3xl">
                OpenTelemetry Collector
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
                A vendor-agnostic implementation for receiving, processing, and exporting telemetry
                data.
              </p>
              {stats.latestVersion && (
                <p className="text-muted-foreground text-sm font-medium">
                  Latest Collector data: v{stats.latestVersion}
                </p>
              )}
            </div>
            <Link
              to="/collector/components"
              className="border-primary/40 bg-primary/10 text-foreground hover:bg-primary/20 focus-visible:ring-primary inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Explore Components
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="collector-component-types" className="space-y-4">
          <div>
            <h2 id="collector-component-types" className="text-foreground text-2xl font-bold">
              Component Types
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPONENT_TYPES.map(({ type, label, description, icon: Icon }) => (
              <Link
                key={type}
                to={`/collector/components?type=${type}`}
                className="group focus-visible:ring-primary block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <article className="border-border/60 bg-card/80 hover:border-primary/40 h-full rounded-lg border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:bg-card">
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-lg">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <ArrowRight
                        className="text-muted-foreground/50 group-hover:text-primary h-5 w-5 transition-all duration-200 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-foreground group-hover:text-primary text-lg font-semibold transition-colors">
                        {label}
                      </h3>
                      <p className="text-3xl font-bold">
                        {numberFormatter.format(stats.byType[type])}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="collector-distributions" className="space-y-4">
          <div>
            <h2 id="collector-distributions" className="text-foreground text-2xl font-bold">
              Distributions
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {DISTRIBUTIONS.map(({ distribution, label, description, buttonLabel }) => (
              <article
                key={distribution}
                className="border-border/60 bg-card/80 flex h-full flex-col rounded-lg border p-6"
              >
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-foreground text-xl font-semibold">{label}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {numberFormatter.format(stats.byDistribution[distribution])} components
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
                    {description}
                  </p>
                  <Link
                    to={`/collector/components?distribution=${distribution}`}
                    className="border-border bg-background text-foreground hover:border-primary/40 hover:bg-card-secondary focus-visible:ring-primary inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {buttonLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-label="Collector summary statistics"
          className="border-border/60 bg-card/80 rounded-lg border p-6"
        >
          <dl className="grid gap-4 text-center sm:grid-cols-3">
            <div className="sm:border-border/60 sm:border-r">
              <dt className="text-muted-foreground text-sm font-medium">Components</dt>
              <dd className="text-foreground mt-1 text-3xl font-bold">
                {numberFormatter.format(stats.total)}
              </dd>
            </div>
            <div className="sm:border-border/60 sm:border-r">
              <dt className="text-muted-foreground text-sm font-medium">Types</dt>
              <dd className="text-foreground mt-1 text-3xl font-bold">{COMPONENT_TYPES.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm font-medium">Distributions</dt>
              <dd className="text-foreground mt-1 text-3xl font-bold">{DISTRIBUTIONS.length}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="collector-resources" className="space-y-4">
          <div>
            <h2 id="collector-resources" className="text-foreground text-2xl font-bold">
              Resources
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {RESOURCES.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/60 bg-card/80 hover:border-primary/40 hover:bg-card focus-visible:ring-primary group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="text-foreground font-medium">{label}</span>
                <ExternalLink
                  className="text-muted-foreground group-hover:text-primary h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
