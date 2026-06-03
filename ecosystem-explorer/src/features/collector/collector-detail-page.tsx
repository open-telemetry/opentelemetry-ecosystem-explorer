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
import { Info, ExternalLink, AlertCircle, Check, Users } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { GitHubIcon } from "@/components/icons/github-icon";

import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DetailCard } from "@/components/ui/detail-card";
import { SectionHeader } from "@/components/ui/section-header";
import { PageContainer } from "@/components/layout/page-container";
import { useCollectorComponent, useCollectorVersions } from "@/hooks/use-collector-data";

export function CollectorDetailPage() {
  const { t } = useTranslation("collector");
  const { distribution, name } = useParams<{ distribution: string; name: string }>();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: versionData } = useCollectorVersions();

  const version =
    searchParams.get("version") || versionData?.versions.find((v) => v.is_latest)?.version || "";

  const versionLoading = !version;
  const {
    data: component,
    loading,
    error,
  } = useCollectorComponent(distribution ?? "", name ?? "", version);
  const [activeTab, setActiveTab] = useState("details");

  const getStabilityLabel = (level: string) =>
    t(`detail.stabilityLabels.${level.toLowerCase()}`, { defaultValue: level });

  if (loading || versionLoading) {
    return (
      <PageContainer>
        <Loader label={t("detail.loading.title")} />
      </PageContainer>
    );
  }

  if (error || !component) {
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
                  {error?.message || t("detail.error.fallback")}
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

  return (
    <PageContainer>
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
                  {
                    value: "owners",
                    label: t("detail.tabs.ownership"),
                    icon: <Users className="h-4 w-4" aria-hidden="true" />,
                  },
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
                          {t(`detail.typeDescriptions.${component.type}`, {
                            defaultValue: "",
                          }) && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {t(`detail.typeDescriptions.${component.type}`)}
                            </p>
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
                <div className="space-y-6">
                  <SectionHeader>{t("detail.sections.stabilityLevels")}</SectionHeader>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(component.status.stability).map(([level, signals]) => (
                      <DetailCard key={level} withHoverEffect>
                        <div className="space-y-3">
                          <GlowBadge
                            variant={
                              level === "stable" ? "success" : level === "beta" ? "info" : "warning"
                            }
                            className="text-xs capitalize"
                          >
                            {getStabilityLabel(level)}
                          </GlowBadge>
                          <div className="flex flex-wrap gap-2">
                            {signals.map((signal) => (
                              <span
                                key={signal}
                                className="bg-muted/50 rounded px-2 py-1 text-sm font-medium"
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                        </div>
                      </DetailCard>
                    ))}
                  </div>

                  <SectionHeader>{t("detail.sections.distributionAvailability")}</SectionHeader>
                  <div className="flex flex-wrap gap-2">
                    {component.status.distributions.map((dist) => (
                      <GlowBadge key={dist} variant="muted" className="capitalize">
                        {dist}
                      </GlowBadge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <AlertCircle className="text-muted-foreground/30 mx-auto h-12 w-12" />
                  <p className="text-muted-foreground mt-4">{t("detail.noStability")}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="owners" className="mt-0 p-6">
              {component.status?.codeowners?.active &&
              component.status.codeowners.active.length > 0 ? (
                <div className="space-y-6">
                  <SectionHeader>{t("detail.sections.codeOwners")}</SectionHeader>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {component.status.codeowners.active.map((owner: string) => (
                      <DetailCard key={owner} withHoverEffect>
                        <div className="flex items-center gap-3">
                          <div className="bg-secondary/10 flex h-10 w-10 items-center justify-center rounded-full">
                            <GitHubIcon className="text-secondary h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{owner}</p>
                            <a
                              href={`https://github.com/${owner.replace("@", "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs hover:underline"
                            >
                              {t("detail.links.viewProfile")}
                            </a>
                          </div>
                        </div>
                      </DetailCard>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Users className="text-muted-foreground/30 mx-auto h-12 w-12" />
                  <p className="text-muted-foreground mt-4">{t("detail.noOwners")}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  );
}
