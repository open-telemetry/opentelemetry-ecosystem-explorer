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
import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Info, ExternalLink, AlertCircle, Check, Activity } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { GitHubIcon } from "@/components/icons/github-icon";
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DetailCard } from "@/components/ui/detail-card";
import { SectionHeader } from "@/components/ui/section-header";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { deriveCollectorMeta } from "@/lib/seo/derive";
import { useCollectorComponent, useCollectorVersions } from "@/hooks/use-collector-data";
import { CollectorTelemetryTab } from "./components/collector-telemetry-tab";

const getBadgeVariant = (level: string): "success" | "info" | "warning" | "muted" => {
  const lower = level.toLowerCase();
  if (lower === "stable") return "success";
  if (lower === "beta") return "info";
  if (
    lower === "alpha" ||
    lower === "development" ||
    lower === "deprecated" ||
    lower === "unmaintained"
  ) {
    return "warning";
  }
  return "muted";
};

export function CollectorDetailPage() {
  const { t } = useTranslation("collector");
  const { distribution, name } = useParams<{ distribution: string; name: string }>();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: versionData, error: versionsError } = useCollectorVersions();

  const version =
    searchParams.get("version") || versionData?.versions.find((v) => v.is_latest)?.version || "";

  // Once the versions fetch has settled with an error, stop waiting for a
  // version to resolve — `version` will never become non-empty otherwise,
  // which would leave this stuck on the loading state forever.
  const versionLoading = !version && !versionsError;
  const {
    data: component,
    loading,
    error,
  } = useCollectorComponent(distribution ?? "", name ?? "", version);
  const [activeTab, setActiveTab] = useState("details");

  const getStabilityLabel = (level: string) =>
    t(`detail.stabilityLabels.${level.toLowerCase()}`, { defaultValue: level });

  const getDistributionInfo = (distroName: string) => {
    const lower = distroName.toLowerCase();
    if (lower.includes("contrib")) {
      return {
        name: t("detail.distributions.contrib.name"),
        desc: t("detail.distributions.contrib.desc"),
        cmdLabel: "# Docker",
        cmd: "docker pull otel/opentelemetry-collector-contrib:latest",
        url: "https://github.com/open-telemetry/opentelemetry-collector-contrib",
      };
    }
    if (lower.includes("core")) {
      return {
        name: t("detail.distributions.core.name"),
        desc: t("detail.distributions.core.desc"),
        cmdLabel: "# Docker",
        cmd: "docker pull otel/opentelemetry-collector:latest",
        url: "https://github.com/open-telemetry/opentelemetry-collector",
      };
    }
    if (lower === "k8s" || lower.includes("kubernetes")) {
      return {
        name: t("detail.distributions.k8s.name"),
        desc: t("detail.distributions.k8s.desc"),
        cmdLabel: "# kubectl",
        cmd: "kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml",
        url: "https://github.com/open-telemetry/opentelemetry-operator",
      };
    }
    return {
      name: distroName,
      desc: t("detail.distributions.generic.desc"),
      cmdLabel: null,
      cmd: null,
      url: "https://opentelemetry.io/docs/collector/installation/",
    };
  };

  if (loading || versionLoading) {
    return (
      <PageContainer>
        <Loader label={t("detail.loading.title")} />
      </PageContainer>
    );
  }

  if (error || (!version && versionsError) || !component) {
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
                  {(error ?? versionsError)?.message || t("detail.error.fallback")}
                </p>
                <button
                  onClick={() => navigate(-1)}
                  className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  {t("detail.error.goBack")}
                </button>
              </div>
            </div>
          </DetailCard>
        </div>
      </PageContainer>
    );
  }

  const dynamicSignals = component.status?.stability
    ? Array.from(new Set(Object.values(component.status.stability).flat() as string[]))
    : [];

  const getSignalStability = (signalName: string) => {
    if (!component.status?.stability) return null;
    for (const [level, signals] of Object.entries(component.status.stability)) {
      if ((signals as string[]).includes(signalName)) return level;
    }
    return null;
  };

  const activeStabilityLevels = component.status?.stability
    ? Object.keys(component.status.stability)
    : [];

  const typeDesc = t(`detail.typeDescriptions.${component.type}`, { defaultValue: "" });

  const seo = deriveCollectorMeta({
    id: `${component.distribution}-${component.name}`,
    name: component.name,
    distribution: component.distribution,
    display_name: component.display_name,
    description: component.description,
    type: component.type,
  });

  return (
    <PageContainer>
      <Seo title={seo.title} description={seo.description} />
      <BackButton />

      <div className="mt-3 space-y-6">
        <header className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-8">
          <div className="bg-gradient-radial from-otel-blue/5 via-otel-orange/2 absolute inset-0 to-transparent opacity-50" />

          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full bg-[linear-gradient(hsl(var(--border-hsl))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border-hsl))_1px,transparent_1px)] bg-[size:32px_32px]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <GlowBadge variant="info" className="text-xs tracking-wider uppercase">
                    {component.type}
                  </GlowBadge>
                  <GlowBadge variant="muted" className="text-xs tracking-wider uppercase">
                    {component.distribution}
                  </GlowBadge>
                </div>
                <h1 className="text-3xl leading-tight font-bold md:text-4xl">
                  <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
                    {component.display_name || component.name}
                  </span>
                </h1>
                <p className="text-sm">
                  <code className="bg-muted text-foreground/80 rounded px-2 py-1">
                    {component.name}
                  </code>
                </p>
              </div>
            </div>

            {component.description && (
              <p className="text-muted-foreground max-w-4xl text-base leading-relaxed">
                {component.description}
              </p>
            )}
          </div>
        </header>

        <div className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-10">
            <div className="px-6 pt-4">
              <SegmentedTabList
                value={activeTab}
                tabs={[
                  {
                    value: "details",
                    label: t("detail.tabs.details"),
                    icon: <Info className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "status",
                    label: t("detail.tabs.stability"),
                    icon: <Check className="h-4 w-4" aria-hidden="true" />,
                  },
                  ...(component.metrics && Object.keys(component.metrics).length > 0
                    ? [
                        {
                          value: "telemetry",
                          label: t("detail.tabs.telemetry"),
                          icon: <Activity className="h-4 w-4" aria-hidden="true" />,
                        },
                      ]
                    : []),
                ]}
              />
            </div>

            <TabsContent value="details" className="mt-0 p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <DetailCard withGrid>
                  <div className="space-y-4">
                    <h3 className="border-border/50 mb-4 border-b pb-2 text-lg font-semibold">
                      {t("detail.sections.componentInfo")}
                    </h3>
                    <div>
                      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        {t("detail.labels.type")}
                      </h4>
                      <div className="mt-1 flex items-start gap-2 text-sm">
                        <Check
                          className="text-secondary mt-0.5 h-4 w-4 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-medium capitalize">{component.type}</span>
                          {typeDesc && (
                            <p className="text-muted-foreground mt-0.5 text-xs">{typeDesc}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        {t("detail.labels.version")}
                      </h4>
                      <p className="mt-1 text-sm font-medium">{version}</p>
                    </div>
                    <div>
                      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        {t("detail.labels.distribution")}
                      </h4>
                      <p className="mt-1 text-sm font-medium capitalize">
                        {component.distribution}
                      </p>
                    </div>
                  </div>
                </DetailCard>

                <DetailCard>
                  <div className="space-y-4">
                    <h3 className="border-border/50 mb-4 border-b pb-2 text-lg font-semibold">
                      {t("detail.sections.linksResources")}
                    </h3>
                    <a
                      href={`https://github.com/open-telemetry/${component.repository}/tree/main/${component.type}/${component.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border/50 hover:bg-muted/50 group flex items-center gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <GitHubIcon className="text-secondary h-5 w-5 transition-transform group-hover:scale-110" />
                      <div>
                        <p className="text-sm font-medium">{t("detail.links.sourceCode")}</p>
                        <p className="text-muted-foreground text-xs">
                          {t("detail.links.viewOnGithub")}
                        </p>
                      </div>
                      <ExternalLink className="text-muted-foreground ml-auto h-4 w-4" />
                    </a>
                  </div>
                </DetailCard>
              </div>
            </TabsContent>

            <TabsContent value="status" className="mt-0 p-6">
              {component.status ? (
                <div className="space-y-10">
                  <div className="space-y-6">
                    <SectionHeader>{t("detail.sections.stabilityLevels")}</SectionHeader>
                    <div className="border-border/60 bg-card overflow-x-auto rounded-lg border shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            {dynamicSignals.map((signal) => (
                              <th
                                key={signal}
                                scope="col"
                                className="border-border/60 text-muted-foreground border-b p-4 font-semibold capitalize"
                              >
                                {signal.replace(/_/g, " ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="divide-border/30 divide-x">
                            {dynamicSignals.map((signal) => {
                              const level = getSignalStability(signal);
                              return (
                                <td key={signal} className="p-4 align-top">
                                  {level ? (
                                    <GlowBadge
                                      variant={getBadgeVariant(level)}
                                      className="text-xs capitalize"
                                    >
                                      {getStabilityLabel(level)}
                                    </GlowBadge>
                                  ) : (
                                    <span className="text-muted-foreground/50 font-mono">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {activeStabilityLevels.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold">
                        {t("detail.sections.stabilityLegend")}
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {activeStabilityLevels.map((level) => {
                          const desc = t(`detail.stabilityDescriptions.${level.toLowerCase()}`, {
                            defaultValue: "",
                          });
                          if (!desc) return null;
                          return (
                            <div
                              key={level}
                              className="border-border/50 bg-card hover:bg-muted/20 rounded-lg border p-4 shadow-sm transition-colors"
                            >
                              <GlowBadge
                                variant={getBadgeVariant(level)}
                                className="w-fit text-xs capitalize"
                              >
                                {getStabilityLabel(level)}
                              </GlowBadge>
                              <p className="text-muted-foreground mt-2 text-sm">{desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {component.status.distributions && component.status.distributions.length > 0 ? (
                    <div className="space-y-6">
                      <div>
                        <SectionHeader>
                          {t("detail.sections.distributionAvailability")}
                        </SectionHeader>
                        <p className="text-muted-foreground mt-2 text-sm">
                          {t("detail.distributions.packaged")}
                        </p>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2">
                        {component.status.distributions.map((dist) => {
                          const distInfo = getDistributionInfo(dist);
                          return (
                            <div
                              key={dist}
                              className="border-border/60 bg-card flex flex-col justify-between rounded-lg border p-5 shadow-sm"
                            >
                              <div>
                                <h3 className="mb-2 text-lg font-bold capitalize">
                                  {distInfo.name}
                                </h3>
                                <p className="text-muted-foreground mb-4 text-sm">
                                  {distInfo.desc}
                                </p>
                              </div>

                              <div className="mt-auto space-y-3">
                                {distInfo.cmd && (
                                  <div className="bg-muted text-foreground overflow-x-auto rounded-md p-3 font-mono text-xs">
                                    <span className="text-muted-foreground">
                                      {distInfo.cmdLabel}
                                    </span>
                                    <br />
                                    {distInfo.cmd}
                                  </div>
                                )}
                                {distInfo.url && (
                                  <a
                                    href={distInfo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                                  >
                                    {t("detail.links.viewDocumentation")}{" "}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <SectionHeader>{t("detail.sections.distributionAvailability")}</SectionHeader>
                      <div className="border-border/60 bg-card flex items-center justify-center rounded-lg border p-8 shadow-sm">
                        <p className="text-muted-foreground text-sm">
                          {t("detail.distributions.noInfo")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <AlertCircle className="text-muted-foreground/30 mx-auto h-12 w-12" />
                  <p className="text-muted-foreground mt-4">{t("detail.noStability")}</p>
                </div>
              )}
            </TabsContent>

            {component.metrics && Object.keys(component.metrics).length > 0 && (
              <TabsContent value="telemetry" className="mt-0 p-6">
                <CollectorTelemetryTab
                  metrics={component.metrics}
                  attributes={component.attributes}
                  resourceAttributes={component.resource_attributes}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </PageContainer>
  );
}
