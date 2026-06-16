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
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Info,
  Activity,
  Settings,
  BookOpen,
  ExternalLink,
  Code,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

import { Loader } from "@/components/ui/loader";

import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DetailCard } from "@/components/ui/detail-card";
import { SectionHeader } from "@/components/ui/section-header";
import { useVersions, useInstrumentation } from "@/hooks/use-javaagent-data";
import {
  getInstrumentationDisplayName,
  getSemanticConventionInfo,
  getFeatureInfo,
} from "./utils/format";
import { TelemetrySection } from "./components/telemetry-section";
import { TelemetryComparisonSection } from "./components/telemetry-comparison/telemetry-comparison-section";
import { VersionSelector } from "./components/version-selector";
import { PageContainer } from "@/components/layout/page-container";
import { Tooltip } from "@/components/ui/tooltip";
import { InstrumentationConfigurationTab } from "./components/instrumentation-configuration-tab";
import { StandaloneLibraryTab } from "./components/standalone-library-tab";
import { renderWithInlineCode } from "@/lib/render-inline-code";

function buildSourceUrl(sourcePath: string): string {
  try {
    new URL(sourcePath);
    return sourcePath;
  } catch {
    const baseUrl =
      "https://github.com/open-telemetry/opentelemetry-java-instrumentation/tree/main/";
    return new URL(sourcePath, baseUrl).toString();
  }
}

/**
 * Returns true only when the URL uses http: or https: protocol.
 * Prevents link-based XSS from non-http(s) schemes such as javascript: or data:.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function InstrumentationDetailPage() {
  const { t } = useTranslation("java-agent");
  const [searchParams] = useSearchParams();
  const { param } = useParams<{ param: string }>();

  const navigate = useNavigate();
  const [showComparison, setShowComparison] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const { data: versionsData, loading: versionsLoading, error: versionsError } = useVersions();

  const latestVersion = versionsData?.versions.find((v) => v.is_latest)?.version;
  const version = searchParams.get("version") || latestVersion;
  const isVersionValid =
    version === "latest" ||
    !versionsData ||
    versionsData.versions.some((v) => v.version === version);

  const shouldFetchInstrumentation = version !== "latest" && isVersionValid;
  const {
    data: instrumentation,
    loading: instrumentationLoading,
    error,
  } = useInstrumentation(
    shouldFetchInstrumentation ? (param ?? "") : "",
    shouldFetchInstrumentation ? (version as string) : ""
  );

  const loading =
    versionsLoading || instrumentationLoading || (version === "latest" && !versionsError);

  useEffect(() => {
    if (version === "latest" && versionsData) {
      if (latestVersion && param) {
        navigate(`/java-agent/instrumentation/${param}`, { replace: true });
      }
    }
  }, [version, param, versionsData, navigate, latestVersion]);

  const handleVersionChange = (newVersion: string) => {
    navigate(
      newVersion != latestVersion
        ? `/java-agent/instrumentation/${param}?version=${newVersion}`
        : `/java-agent/instrumentation/${param}`
    );
  };

  if (loading) {
    return (
      <PageContainer>
        <Loader label={t("detail.loading.title")} />
      </PageContainer>
    );
  }

  if (versionsError) {
    return (
      <PageContainer>
        <BackButton />
        <div className="mt-3">
          <DetailCard className="border-red-500/50 bg-red-500/5">
            <div className="flex gap-4">
              <AlertCircle
                className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-red-600 dark:text-red-400">
                  {t("detail.error.versionsError")}
                </h3>
                <p className="text-sm text-red-600/90 dark:text-red-400/90">
                  {versionsError.message}
                </p>
              </div>
            </div>
          </DetailCard>
        </div>
      </PageContainer>
    );
  }

  if (!isVersionValid && versionsData) {
    return (
      <PageContainer>
        <BackButton />
        <div className="mt-3">
          <DetailCard className="border-yellow-500/50 bg-yellow-500/5">
            <div className="flex gap-4">
              <AlertCircle
                className="h-6 w-6 flex-shrink-0 text-yellow-600 dark:text-yellow-400"
                aria-hidden="true"
              />
              <div className="flex-1 space-y-3">
                <h3 className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {t("detail.error.versionNotFound")}
                </h3>
                <p className="text-sm text-yellow-600/90 dark:text-yellow-400/90">
                  Version <code className="rounded bg-yellow-500/10 px-1 py-0.5">{version}</code>{" "}
                  {t("detail.error.versionDoesNotExist")}
                </p>
                {latestVersion && param && (
                  <Link
                    to={`/java-agent/instrumentation/${param}?version=${latestVersion}`}
                    className="inline-flex items-center gap-1.5 text-sm text-yellow-600 underline hover:no-underline dark:text-yellow-400"
                  >
                    {t("detail.error.viewLatest", { name: param, latestVersion })}
                  </Link>
                )}
              </div>
            </div>
          </DetailCard>
        </div>
      </PageContainer>
    );
  }

  if (error || !instrumentation) {
    return (
      <PageContainer>
        <BackButton />
        <div className="mt-3">
          <DetailCard className="border-red-500/50 bg-red-500/5">
            <div className="flex gap-4">
              <AlertCircle
                className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-red-600 dark:text-red-400">
                  {t("detail.error.title")}
                </h3>
                <p className="text-sm text-red-600/90 dark:text-red-400/90">
                  {error?.message || t("detail.error.notFound")}
                </p>
              </div>
            </div>
          </DetailCard>
        </div>
      </PageContainer>
    );
  }

  const displayName = getInstrumentationDisplayName(instrumentation);
  const showRawName =
    instrumentation.display_name && instrumentation.display_name !== instrumentation.name;

  return (
    <PageContainer>
      <BackButton />

      <div className="mt-3 space-y-6">
        <header className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-5 sm:p-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, hsl(var(--hero-accent-hsl) / 0.06) 0%, hsl(var(--hero-accent-alt-hsl) / 0.03) 40%, transparent 70%)",
            }}
          />

          <div className="absolute inset-0 opacity-5">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="text-2xl leading-tight font-bold sm:text-3xl md:text-4xl">
                  <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
                    {displayName}
                  </span>
                </h1>
                {showRawName && (
                  <p className="text-sm">
                    <code className="bg-muted text-foreground rounded px-2 py-1">
                      {instrumentation.name}
                    </code>
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
                {versionsData &&
                  versionsData.versions.length > 0 &&
                  version &&
                  version !== "latest" && (
                    <VersionSelector
                      versions={versionsData.versions}
                      currentVersion={version}
                      onVersionChange={handleVersionChange}
                    />
                  )}
                <GlowBadge
                  variant={instrumentation.disabled_by_default ? "warning" : "success"}
                  withGlow
                >
                  {instrumentation.disabled_by_default
                    ? t("detail.badges.disabledByDefault")
                    : t("detail.badges.enabledByDefault")}
                </GlowBadge>
              </div>
            </div>

            {instrumentation.description && (
              <p className="text-muted-foreground max-w-4xl text-base leading-relaxed">
                {renderWithInlineCode(instrumentation.description)}
              </p>
            )}
          </div>

          <div className="pointer-events-none absolute -right-1 -bottom-1 h-24 w-24 opacity-80">
            <svg viewBox="0 0 64 64" className="h-full w-full">
              <path
                d="M64 64 L64 32 L48 32 L48 48 L32 48 L32 64 Z"
                style={{ fill: "hsl(var(--otel-orange-hsl) / 0.5)" }}
              />
            </svg>
          </div>
        </header>

        <div className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border">
          <div className="absolute inset-0 opacity-5">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-10">
            <div className="px-4 pt-4 pb-0 sm:px-6">
              <SegmentedTabList
                fullWidth
                value={activeTab}
                tabs={[
                  {
                    value: "details",
                    label: t("detail.tabs.details"),
                    icon: <Info className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "telemetry",
                    label: t("detail.tabs.telemetry"),
                    icon: <Activity className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "configuration",
                    label: t("detail.tabs.configuration"),
                    icon: <Settings className="h-4 w-4" aria-hidden="true" />,
                  },
                  ...(instrumentation.has_standalone_library && instrumentation.markdown_hash
                    ? [
                        {
                          value: "standalone-library",
                          label: t("detail.tabs.standaloneLibrary"),
                          icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
                        },
                      ]
                    : []),
                ]}
              />
            </div>

            <TabsContent value="details" className="mt-0 p-4 sm:p-6">
              <div className="space-y-8">
                {((instrumentation.features && instrumentation.features.length > 0) ||
                  (instrumentation.semantic_conventions &&
                    instrumentation.semantic_conventions.length > 0)) && (
                  <div>
                    <SectionHeader>{t("detail.sections.capabilities")}</SectionHeader>
                    <div className="space-y-4">
                      {instrumentation.features && instrumentation.features.length > 0 && (
                        <DetailCard>
                          <div className="space-y-3">
                            <h3 className="text-muted-foreground text-sm font-medium">
                              {t("detail.fields.features")}
                            </h3>
                            <ul className="space-y-2">
                              {instrumentation.features.map((feature) => {
                                const info = getFeatureInfo(feature);
                                return (
                                  <li key={feature} className="flex items-start gap-2 text-sm">
                                    <Check
                                      className="text-secondary mt-0.5 h-4 w-4 flex-shrink-0"
                                      aria-hidden="true"
                                    />
                                    <div>
                                      <span className="font-medium">
                                        {info ? info.label : feature}
                                      </span>
                                      {info && (
                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                          {info.description}
                                        </p>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </DetailCard>
                      )}

                      {instrumentation.semantic_conventions &&
                        instrumentation.semantic_conventions.length > 0 && (
                          <DetailCard>
                            <div className="space-y-3">
                              <h3 className="text-muted-foreground text-sm font-medium">
                                {t("detail.fields.semanticConventions")}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {instrumentation.semantic_conventions.map((convention) => {
                                  const info = getSemanticConventionInfo(convention);
                                  if (info) {
                                    return (
                                      <a
                                        key={convention}
                                        href={info.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-md border px-3 py-1 text-sm transition-colors"
                                      >
                                        {info.label}
                                      </a>
                                    );
                                  }
                                  return (
                                    <GlowBadge key={convention} variant="muted">
                                      {convention}
                                    </GlowBadge>
                                  );
                                })}
                              </div>
                            </div>
                          </DetailCard>
                        )}
                    </div>
                  </div>
                )}

                {(instrumentation.minimum_java_version || instrumentation.has_javaagent) && (
                  <div>
                    <SectionHeader>{t("detail.sections.requirements")}</SectionHeader>
                    <div className="space-y-4">
                      {instrumentation.minimum_java_version && (
                        <DetailCard withGrid withHoverEffect>
                          <div className="space-y-2">
                            <h3 className="text-muted-foreground text-sm font-medium">
                              {t("detail.fields.minimumJavaVersion")}
                            </h3>
                            <p className="text-foreground text-lg font-semibold">
                              {instrumentation.minimum_java_version}
                            </p>
                          </div>
                        </DetailCard>
                      )}

                      {instrumentation.javaagent_target_versions &&
                        instrumentation.javaagent_target_versions.length > 0 && (
                          <DetailCard>
                            <div className="space-y-3">
                              <h3 className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                                {t("detail.fields.targetVersions")}
                                <Tooltip content={t("detail.tooltips.targetVersions")}>
                                  <HelpCircle
                                    className="focus:ring-ring h-3.5 w-3.5 cursor-help rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-1 focus:outline-none"
                                    aria-label={t("detail.tooltips.moreInfoAriaLabel", {
                                      field: t("detail.fields.targetVersions"),
                                    })}
                                    tabIndex={0}
                                    role="button"
                                  />
                                </Tooltip>
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {instrumentation.javaagent_target_versions.map((targetVersion) => (
                                  <GlowBadge key={targetVersion} variant="muted">
                                    {targetVersion}
                                  </GlowBadge>
                                ))}
                              </div>
                            </div>
                          </DetailCard>
                        )}
                    </div>
                  </div>
                )}

                {instrumentation.scope && (
                  <div>
                    <SectionHeader>
                      <div className="flex items-center gap-2">
                        {t("detail.sections.scope")}
                        <Tooltip content={t("detail.tooltips.scope")}>
                          <HelpCircle
                            className="focus:ring-ring h-4 w-4 cursor-help rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-1 focus:outline-none"
                            aria-label={t("detail.tooltips.moreInfoAriaLabel", {
                              field: t("detail.sections.scope"),
                            })}
                            tabIndex={0}
                            role="button"
                          />
                        </Tooltip>
                      </div>
                    </SectionHeader>
                    <DetailCard withGrid>
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-muted-foreground text-sm font-medium">
                            {t("detail.fields.scopeName")}
                          </h3>
                          <p className="text-foreground mt-1 text-sm font-medium">
                            {instrumentation.scope.name}
                          </p>
                        </div>
                        {instrumentation.scope.schema_url && (
                          <div>
                            <h3 className="text-muted-foreground text-sm font-medium">
                              {t("detail.fields.schemaUrl")}
                            </h3>
                            <code className="bg-muted mt-1 block rounded px-2 py-1 text-xs break-all">
                              {instrumentation.scope.schema_url}
                            </code>
                          </div>
                        )}
                      </div>
                    </DetailCard>
                  </div>
                )}

                {(instrumentation.library_link || instrumentation.source_path) && (
                  <div>
                    <SectionHeader>{t("detail.sections.links")}</SectionHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      {instrumentation.library_link && isSafeUrl(instrumentation.library_link) && (
                        <DetailCard withHoverEffect>
                          <div className="flex items-start gap-3">
                            <ExternalLink
                              className="text-secondary mt-0.5 h-5 w-5 flex-shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex-1 space-y-1">
                              <h3 className="text-muted-foreground text-sm font-medium">
                                {t("detail.fields.libraryLink")}
                              </h3>
                              <a
                                href={instrumentation.library_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-secondary text-sm break-all hover:underline"
                              >
                                {instrumentation.library_link}
                              </a>
                            </div>
                          </div>
                        </DetailCard>
                      )}

                      {instrumentation.source_path &&
                        isSafeUrl(buildSourceUrl(instrumentation.source_path)) && (
                          <DetailCard withHoverEffect>
                            <div className="flex items-start gap-3">
                              <Code
                                className="text-secondary mt-0.5 h-5 w-5 flex-shrink-0"
                                aria-hidden="true"
                              />
                              <div className="flex-1 space-y-1">
                                <h3 className="text-muted-foreground text-sm font-medium">
                                  {t("detail.fields.sourcePath")}
                                </h3>
                                <a
                                  href={buildSourceUrl(instrumentation.source_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-secondary text-sm break-all hover:underline"
                                >
                                  {instrumentation.source_path}
                                </a>
                              </div>
                            </div>
                          </DetailCard>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="telemetry" className="mt-0 p-4 sm:p-6">
              {instrumentation.telemetry && instrumentation.telemetry.length > 0 ? (
                <div className="space-y-8">
                  <div className="flex justify-center">
                    <div
                      className="border-border inline-flex w-full rounded-lg border bg-transparent p-1 sm:w-auto"
                      role="group"
                    >
                      <button
                        type="button"
                        onClick={() => setShowComparison(false)}
                        aria-pressed={!showComparison}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out sm:flex-none ${
                          !showComparison
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("detail.view.current")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowComparison(true)}
                        aria-pressed={showComparison}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out sm:flex-none ${
                          showComparison
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("detail.view.comparison")}
                      </button>
                    </div>
                  </div>

                  {!showComparison ? (
                    <TelemetrySection telemetry={instrumentation.telemetry} />
                  ) : (
                    versionsData && (
                      <TelemetryComparisonSection
                        instrumentationName={name ?? ""}
                        versions={versionsData.versions}
                        currentVersion={version ?? ""}
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <Activity
                      className="text-muted-foreground/50 mx-auto h-12 w-12"
                      aria-hidden="true"
                    />
                    <p className="text-muted-foreground mt-4 text-sm">
                      {t("detail.telemetry.empty")}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="configuration" className="mt-0 p-4 sm:p-6">
              <InstrumentationConfigurationTab
                configurations={instrumentation.configurations ?? []}
              />
            </TabsContent>
            {instrumentation.has_standalone_library && instrumentation.markdown_hash && (
              <TabsContent value="standalone-library" className="mt-0 p-4 sm:p-6">
                <StandaloneLibraryTab
                  name={instrumentation.name}
                  markdownHash={instrumentation.markdown_hash}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </PageContainer>
  );
}
