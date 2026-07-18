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
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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

import { useCollectorIndex, useCollectorVersions } from "@/hooks/use-collector-data";
import type { IndexComponent } from "@/types/collector";

const COMPONENT_TYPES = [
  { type: "receiver", icon: Box },
  { type: "processor", icon: Layers },
  { type: "exporter", icon: Send },
  { type: "extension", icon: Plug },
  { type: "connector", icon: Workflow },
] as const;

const DISTRIBUTIONS = [{ distribution: "core" }, { distribution: "contrib" }] as const;

const RESOURCES = [
  {
    key: "officialDocs",
    href: "https://opentelemetry.io/docs/collector/",
  },
  {
    key: "gettingStarted",
    href: "https://opentelemetry.io/docs/collector/getting-started/",
  },
  {
    key: "configReference",
    href: "https://opentelemetry.io/docs/collector/configuration/",
  },
  {
    key: "githubCore",
    href: "https://github.com/open-telemetry/opentelemetry-collector",
  },
  {
    key: "githubContrib",
    href: "https://github.com/open-telemetry/opentelemetry-collector-contrib",
  },
] as const;

type CollectorComponentType = (typeof COMPONENT_TYPES)[number]["type"];
type CollectorDistribution = (typeof DISTRIBUTIONS)[number]["distribution"];

interface CollectorLandingStats {
  byDistribution: Record<CollectorDistribution, number>;
  byType: Record<CollectorComponentType, number>;
  latestVersion: string | null;
  total: number;
}

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

function isComponentType(value: unknown): value is CollectorComponentType {
  return typeof value === "string" && COMPONENT_TYPES.some(({ type }) => type === value);
}

function isDistribution(value: unknown): value is CollectorDistribution {
  return (
    typeof value === "string" && DISTRIBUTIONS.some(({ distribution }) => distribution === value)
  );
}

function buildCollectorLandingStats(
  components: IndexComponent[],
  latestVersion: string | null
): CollectorLandingStats {
  const byType = emptyTypeCounts();
  const byDistribution = emptyDistributionCounts();

  for (const component of components) {
    if (isComponentType(component.type)) {
      byType[component.type] += 1;
    }
    if (isDistribution(component.distribution)) {
      byDistribution[component.distribution] += 1;
    }
  }

  return {
    byDistribution,
    byType,
    latestVersion,
    total: components.length,
  };
}

export function CollectorExploreLanding() {
  const { t, i18n } = useTranslation("collector");
  const { data: collectorIndex, loading: indexLoading, error: indexError } = useCollectorIndex();
  const {
    data: versionData,
    loading: versionsLoading,
    error: versionsError,
  } = useCollectorVersions();
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language),
    [i18n.resolvedLanguage, i18n.language]
  );
  const stats = useMemo(() => {
    if (!collectorIndex || !versionData) {
      return null;
    }

    return buildCollectorLandingStats(
      collectorIndex.components,
      versionData.versions.find((version) => version.is_latest)?.version ??
        versionData.versions[0]?.version ??
        null
    );
  }, [collectorIndex, versionData]);

  const error = indexError ?? versionsError;

  if (error) {
    return (
      <section
        role="alert"
        className="border-border/60 bg-card/80 flex min-h-72 flex-col items-center justify-center rounded-lg border p-8 text-center"
      >
        <AlertCircle className="text-primary h-10 w-10" aria-hidden="true" />
        <h2 className="text-foreground mt-4 text-lg font-semibold">{t("explore.error")}</h2>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm">{error.message}</p>
      </section>
    );
  }

  if (indexLoading || versionsLoading || !stats) {
    return (
      <section
        aria-live="polite"
        className="border-border/60 bg-card/80 flex min-h-72 flex-col items-center justify-center rounded-lg border p-8 text-center"
      >
        <Loader2 className="text-primary h-10 w-10 animate-spin" aria-hidden="true" />
        <p className="text-muted-foreground mt-4 text-sm font-medium">{t("explore.loading")}</p>
      </section>
    );
  }

  return (
    <section className="bg-background relative px-0 py-2">
      <div className="mx-auto max-w-6xl space-y-10">
        <section aria-labelledby="collector-component-types" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="collector-component-types" className="text-foreground text-2xl font-bold">
              {t("explore.componentTypes.heading")}
            </h2>
            {stats.latestVersion && (
              <p className="text-muted-foreground text-sm font-medium">
                {t("explore.componentTypes.latestVersion")}{" "}
                <span className="text-foreground font-semibold">v{stats.latestVersion}</span>
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPONENT_TYPES.map(({ type, icon: Icon }) => (
              <Link
                key={type}
                to={`/collector/components?type=${type}`}
                className="group focus-visible:ring-primary block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <article className="border-border/60 bg-card/80 hover:border-primary/40 hover:bg-card h-full rounded-lg border p-6 transition-all duration-200 hover:-translate-y-0.5">
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
                        {t(`explore.componentTypes.types.${type}.label`)}
                      </h3>
                      <p className="text-3xl font-bold">
                        {numberFormatter.format(stats.byType[type])}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(`explore.componentTypes.types.${type}.description`)}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="collector-distributions" className="space-y-4">
          <div>
            <h2 id="collector-distributions" className="text-foreground text-2xl font-bold">
              {t("explore.distributions.heading")}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {DISTRIBUTIONS.map(({ distribution }) => (
              <article
                key={distribution}
                className="border-border/60 bg-card/80 flex h-full flex-col rounded-lg border p-6"
              >
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-foreground text-xl font-semibold">
                        {t(`filters.distribution.${distribution}`)}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {t("explore.distributions.componentCount", {
                          count: stats.byDistribution[distribution],
                          formattedCount: numberFormatter.format(
                            stats.byDistribution[distribution]
                          ),
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
                    {t(`explore.distributions.items.${distribution}.description`)}
                  </p>
                  <Link
                    to={`/collector/components?distribution=${distribution}`}
                    className="border-border bg-background text-foreground hover:border-primary/40 hover:bg-card-secondary focus-visible:ring-primary inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {t(`explore.distributions.items.${distribution}.button`)}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-label={t("explore.summary.ariaLabel")}
          className="border-border/60 bg-card/80 rounded-lg border p-6"
        >
          <dl className="grid gap-4 text-center sm:grid-cols-3">
            <div className="sm:border-border/60 sm:border-r">
              <dt className="text-muted-foreground text-sm font-medium">
                {t("explore.summary.components")}
              </dt>
              <dd className="text-foreground mt-1 text-3xl font-bold">
                {numberFormatter.format(stats.total)}
              </dd>
            </div>
            <div className="sm:border-border/60 sm:border-r">
              <dt className="text-muted-foreground text-sm font-medium">
                {t("explore.summary.types")}
              </dt>
              <dd className="text-foreground mt-1 text-3xl font-bold">{COMPONENT_TYPES.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm font-medium">
                {t("explore.distributions.heading")}
              </dt>
              <dd className="text-foreground mt-1 text-3xl font-bold">{DISTRIBUTIONS.length}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="collector-resources" className="space-y-4">
          <div>
            <h2 id="collector-resources" className="text-foreground text-2xl font-bold">
              {t("explore.resources.heading")}
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {RESOURCES.map(({ key, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/60 bg-card/80 hover:border-primary/40 hover:bg-card focus-visible:ring-primary group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="text-foreground font-medium">
                  {t(`explore.resources.items.${key}`)}
                </span>
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
