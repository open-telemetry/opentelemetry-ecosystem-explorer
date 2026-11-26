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
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, Archive, BookOpen, Code2, ExternalLink } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { BackButton } from "@/components/ui/back-button";
import { DetailCard } from "@/components/ui/detail-card";
import { StatusPill } from "@/components/ui/status-pill";
import { MarkdownDescription } from "@/components/ui/markdown-description";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { clampDescription } from "@/lib/seo/derive";
import { isSafeUrl } from "@/features/java-agent/utils/url";
import { useContribComponent } from "./hooks/use-java-contrib";
import {
  ComponentTypeBadges,
  DistributionBadges,
  JavaVersionBadge,
} from "./components/contrib-badges";
import { ContribInstallSnippet } from "./components/contrib-install-snippet";
import { ContribConfigurationSection } from "./components/contrib-configuration-section";

const CONTRIB_REPO_URL = "https://github.com/open-telemetry/opentelemetry-java-contrib";
const LIST_PATH = "/java-agent/contrib";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <DetailCard>
      <section className="space-y-4">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {children}
      </section>
    </DetailCard>
  );
}

function ExternalLinkRow({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  if (!isSafeUrl(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border/60 bg-background/50 hover:border-primary/50 hover:text-primary inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
    >
      {icon}
      {label}
    </a>
  );
}

export function JavaContribDetailPage() {
  const { t } = useTranslation("java-agent");
  const { name = "" } = useParams<{ name: string }>();
  const { data: entry, loading, error } = useContribComponent(name);

  if (loading) {
    return (
      <PageContainer>
        <Loader label={t("contrib.detail.loading")} />
      </PageContainer>
    );
  }

  if (error || !entry) {
    return (
      <PageContainer>
        <BackButton fallbackTo={LIST_PATH} />
        <div className="mt-3">
          <DetailCard className="border-red-500/50 bg-red-500/5">
            <div className="flex gap-4">
              <AlertCircle
                className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <div className="flex-1 space-y-2">
                <h1 className="font-semibold text-red-600 dark:text-red-400">
                  {t("contrib.detail.notFound", { name })}
                </h1>
                {error && (
                  <p className="text-sm text-red-600/90 dark:text-red-400/90">{error.message}</p>
                )}
                <Link to={LIST_PATH} className="text-primary text-sm underline hover:no-underline">
                  {t("contrib.detail.backToList")}
                </Link>
              </div>
            </div>
          </DetailCard>
        </div>
      </PageContainer>
    );
  }

  const { component, problems } = entry;
  const sourceUrl = component.source_path
    ? `${CONTRIB_REPO_URL}/tree/main/${component.source_path}`
    : null;

  return (
    <PageContainer>
      <Seo
        title={t("contrib.detail.seoTitle", { name: component.display_name })}
        description={clampDescription(component.description) || undefined}
      />
      <BackButton fallbackTo={LIST_PATH} />

      <div className="mt-3 space-y-6">
        <header className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-5 sm:p-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, hsl(var(--hero-accent-hsl) / 0.06) 0%, hsl(var(--hero-accent-alt-hsl) / 0.03) 40%, transparent 70%)",
            }}
          />
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="text-2xl leading-tight font-bold sm:text-3xl md:text-4xl">
                  <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
                    {component.display_name}
                  </span>
                </h1>
                {component.source_path && (
                  <p className="text-sm">
                    <code className="bg-muted text-foreground rounded px-2 py-1 break-all">
                      {component.source_path}
                    </code>
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                <StatusPill stability={component.status.stability} />
                <ComponentTypeBadges types={component.component_types} />
                <DistributionBadges distributions={component.distributions} />
                <JavaVersionBadge version={component.min_java_version} />
              </div>
            </div>
            <MarkdownDescription
              text={component.description}
              className="text-muted-foreground max-w-4xl text-base leading-relaxed"
            />
            <div className="flex flex-wrap gap-2">
              <ExternalLinkRow
                href={component.docs_url}
                icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
                label={t("contrib.detail.links.docs")}
              />
              {sourceUrl && (
                <ExternalLinkRow
                  href={sourceUrl}
                  icon={<Code2 className="h-4 w-4" aria-hidden="true" />}
                  label={t("contrib.detail.links.source")}
                />
              )}
            </div>
          </div>
        </header>

        {component.status.stability === "deprecated" && (
          <div
            role="note"
            className="flex gap-3 rounded-lg border border-red-500/50 bg-red-500/5 p-4 text-sm"
          >
            <Archive
              className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <p className="text-red-700 dark:text-red-300">
              {component.status.replaced_by ? (
                <Trans
                  t={t}
                  i18nKey="contrib.detail.deprecated.replacedBy"
                  values={{ name: component.status.replaced_by }}
                  components={{
                    replacement: (
                      <Link
                        to={`${LIST_PATH}/${component.status.replaced_by}`}
                        className="font-semibold underline hover:no-underline"
                      />
                    ),
                  }}
                />
              ) : (
                t("contrib.detail.deprecated.noReplacement")
              )}
            </p>
          </div>
        )}

        {import.meta.env.DEV && problems.length > 0 && (
          <details className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {t("contrib.problems.heading", { count: problems.length })}
            </summary>
            <ul className="mt-3 list-disc space-y-1 pl-6 font-mono text-xs text-yellow-800 dark:text-yellow-300">
              {problems.map((problem, i) => (
                <li key={i}>{problem}</li>
              ))}
            </ul>
          </details>
        )}

        <Section title={t("contrib.detail.usage")}>
          <MarkdownDescription
            text={component.usage}
            className="text-muted-foreground text-sm leading-relaxed"
          />
        </Section>

        {component.artifact && (
          <Section title={t("contrib.detail.install.heading")}>
            <ContribInstallSnippet artifact={component.artifact} />
          </Section>
        )}

        {component.distributions.length > 0 && (
          <Section title={t("contrib.detail.distributions.heading")}>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("contrib.detail.distributions.description")}
            </p>
            <ul className="space-y-2">
              {component.distributions.map((d) => (
                <li key={d.name}>
                  <a
                    href={d.repository_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
                  >
                    {t(`contrib.distribution.${d.name}.name`)}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t("contrib.detail.configuration.heading")}>
          <ContribConfigurationSection configurations={component.configurations} />
        </Section>
      </div>
    </PageContainer>
  );
}
