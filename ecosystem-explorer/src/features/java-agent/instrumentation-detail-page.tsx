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
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Info,
  Activity,
  Settings,
  ExternalLink,
  Code,
  Check,
  AlertCircle,
  Loader2,
  HelpCircle,
} from "lucide-react";

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
  const { version, name } = useParams<{ version: string; name: string }>();
  const navigate = useNavigate();
  const [showComparison, setShowComparison] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const { data: versionsData, loading: versionsLoading } = useVersions();

  const shouldFetchInstrumentation = version !== "latest";
  const {
    data: instrumentation,
    loading: instrumentationLoading,
    error,
  } = useInstrumentation(
    shouldFetchInstrumentation ? (name ?? "") : "",
    shouldFetchInstrumentation ? (version ?? "") : ""
  );

  const loading = versionsLoading || instrumentationLoading;

  useEffect(() => {
    if (version === "latest" && versionsData) {
      const latestVersion = versionsData.versions.find((v) => v.is_latest)?.version;
      if (latestVersion && name) {
        navigate(`/java-agent/instrumentation/${latestVersion}/${name}`, { replace: true });
      }
    }
  }, [version, name, versionsData, navigate]);

  const handleVersionChange = (newVersion: string) => {
    navigate(`/java-agent/instrumentation/${newVersion}/${name}`);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div
              className="inline-flex animate-pulse rounded-full p-4"
              style={{
                boxShadow: "0 0 60px hsl(var(--primary-hsl) / 0.2)",
              }}
            >
              <Loader2 className="text-primary h-12 w-12 animate-spin" aria-hidden="true" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="text-lg font-medium">Loading instrumentation...</div>
              <div className="text-muted-foreground text-sm">This may take a moment</div>
            </div>
          </div>
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
                  Error loading instrumentation
                </h3>
                <p className="text-sm text-red-600/90 dark:text-red-400/90">
                  {error?.message || "Instrumentation not found"}
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
        <header className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, hsl(var(--primary-hsl) / 0.06) 0%, hsl(var(--secondary-hsl) / 0.03) 40%, transparent 70%)",
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
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <h1 className="text-3xl leading-tight font-bold md:text-4xl">
                  <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
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

              <div className="flex flex-shrink-0 items-center gap-3">
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
                    ? "Disabled by Default"
                    : "Enabled by Default"}
                </GlowBadge>
              </div>
            </div>

            {instrumentation.description && (
              <p className="text-muted-foreground max-w-4xl text-base leading-relaxed">
                {instrumentation.description}
              </p>
            )}
          </div>

          <div className="pointer-events-none absolute -right-1 -bottom-1 h-24 w-24 opacity-80">
            <svg viewBox="0 0 64 64" className="h-full w-full">
              <path
                d="M64 64 L64 32 L48 32 L48 48 L32 48 L32 64 Z"
                style={{ fill: "hsl(var(--secondary-hsl) / 0.5)" }}
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
            <div className="px-6 pt-4 pb-0">
              <SegmentedTabList
                value={activeTab}
                tabs={[
                  {
                    value: "details",
                    label: "Details",
                    icon: <Info className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "telemetry",
                    label: "Telemetry",
                    icon: <Activity className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "configuration",
                    label: "Configuration",
                    icon: <Settings className="h-4 w-4" aria-hidden="true" />,
                  },
                ]}
              />
            </div>

            <TabsContent value="details" className="mt-0 p-6">
              <div className="space-y-8">
                {((instrumentation.features && instrumentation.features.length > 0) ||
                  (instrumentation.semantic_conventions &&
                    instrumentation.semantic_conventions.length > 0)) && (
                  <div>
                    <SectionHeader>Capabilities</SectionHeader>
                    <div className="space-y-4">
                      {instrumentation.features && instrumentation.features.length > 0 && (
                        <DetailCard>
                          <div className="space-y-3">
                            <h3 className="text-muted-foreground text-sm font-medium">Features</h3>
                            <ul className="space-y-2">
                              {instrumentation.features.map((feature) => {
                                const info = getFeatureInfo(feature);
                                return (
                                  <li key={feature} className="flex items-start gap-2 text-sm">
                                    <Check
                                      className="text-primary mt-0.5 h-4 w-4 flex-shrink-0"
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
                                Semantic Conventions
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
                                        className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 rounded-md border px-3 py-1 text-sm transition-colors"
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
                    <SectionHeader>Requirements</SectionHeader>
                    <div className="space-y-4">
                      {instrumentation.minimum_java_version && (
                        <DetailCard withGrid withHoverEffect>
                          <div className="space-y-2">
                            <h3 className="text-muted-foreground text-sm font-medium">
                              Minimum Java Version
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
                                Target Versions
                                <Tooltip content="The versions of the target library that this instrumentation supports.">
                                  <HelpCircle
                                    className="focus:ring-ring h-3.5 w-3.5 cursor-help rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-1 focus:outline-none"
                                    aria-label="More information about target versions"
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
                        Instrumentation Scope
                        <Tooltip content="An instrumentation scope is metadata indicating the identity of what produced a piece of telemetry.">
                          <HelpCircle
                            className="focus:ring-ring h-4 w-4 cursor-help rounded-full opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-1 focus:outline-none"
                            aria-label="More information about instrumentation scope"
                            tabIndex={0}
                            role="button"
                          />
                        </Tooltip>
                      </div>
                    </SectionHeader>
                    <DetailCard withGrid>
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-muted-foreground text-sm font-medium">Scope Name</h3>
                          <p className="text-foreground mt-1 text-sm font-medium">
                            {instrumentation.scope.name}
                          </p>
                        </div>
                        {instrumentation.scope.schema_url && (
                          <div>
                            <h3 className="text-muted-foreground text-sm font-medium">
                              Schema URL
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
                    <SectionHeader>Links & Resources</SectionHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                      {instrumentation.library_link && isSafeUrl(instrumentation.library_link) && (
                        <DetailCard withHoverEffect>
                          <div className="flex items-start gap-3">
                            <ExternalLink
                              className="text-primary mt-0.5 h-5 w-5 flex-shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex-1 space-y-1">
                              <h3 className="text-muted-foreground text-sm font-medium">
                                Library Link
                              </h3>
                              <a
                                href={instrumentation.library_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary text-sm break-all hover:underline"
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
                                className="text-primary mt-0.5 h-5 w-5 flex-shrink-0"
                                aria-hidden="true"
                              />
                              <div className="flex-1 space-y-1">
                                <h3 className="text-muted-foreground text-sm font-medium">
                                  Source Path
                                </h3>
                                <a
                                  href={buildSourceUrl(instrumentation.source_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary text-sm break-all hover:underline"
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

            <TabsContent value="telemetry" className="mt-0 p-6">
              {instrumentation.telemetry && instrumentation.telemetry.length > 0 ? (
                <div className="space-y-8">
                  <div className="flex justify-center">
                    <div
                      className="border-border inline-flex rounded-lg border bg-transparent p-1"
                      role="group"
                    >
                      <button
                        type="button"
                        onClick={() => setShowComparison(false)}
                        aria-pressed={!showComparison}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out ${
                          !showComparison
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Current View
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowComparison(true)}
                        aria-pressed={showComparison}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out ${
                          showComparison
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Version Comparison
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
                      No telemetry information available.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="configuration" className="mt-0 p-6">
              <InstrumentationConfigurationTab
                configurations={instrumentation.configurations ?? []}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  );
}
