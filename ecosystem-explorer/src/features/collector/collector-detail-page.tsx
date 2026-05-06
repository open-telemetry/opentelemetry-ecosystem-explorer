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
import { useParams, useNavigate } from "react-router-dom";
import { Info, ExternalLink, AlertCircle, Loader2, Check, Users } from "lucide-react";
import { GitHubIcon } from "@/components/icons/github-icon";

import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DetailCard } from "@/components/ui/detail-card";
import { SectionHeader } from "@/components/ui/section-header";
import { PageContainer } from "@/components/layout/page-container";
import { useCollectorComponent } from "@/hooks/use-collector-data";

const COMPONENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  receiver: "Receivers collect telemetry data from various sources and formats.",
  processor:
    "Processors transform, filter, or enrich telemetry data between receivers and exporters.",
  exporter: "Exporters send telemetry data to one or more backends or destinations.",
  extension:
    "Extensions provide additional capabilities to the collector without processing telemetry data.",
  connector: "Connectors act as both an exporter and a receiver, joining two pipelines together.",
};

export function CollectorDetailPage() {
  const { version, id } = useParams<{ version: string; id: string }>();
  const navigate = useNavigate();
  const { data: component, loading, error } = useCollectorComponent(id ?? "", version ?? "");
  const [activeTab, setActiveTab] = useState("details");

  const getStabilityLabel = (level: string) => {
    const labels: Record<string, string> = {
      alpha: "Alpha",
      beta: "Beta",
      stable: "Stable",
      deprecated: "Deprecated",
      unmaintained: "Unmaintained",
      development: "In Development",
    };
    return labels[level.toLowerCase()] || level;
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="inline-flex animate-pulse rounded-full p-4 shadow-[0_0_60px_hsl(var(--primary-hsl)/0.2)]">
              <Loader2 className="text-primary h-12 w-12 animate-spin" aria-hidden="true" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="text-foreground text-lg font-medium">Loading component...</div>
              <div className="text-muted-foreground text-sm">This may take a moment</div>
            </div>
          </div>
        </div>
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
                  Error loading component
                </h3>
                <p className="text-sm text-red-600/90 dark:text-red-400/90">
                  {error?.message || "Component not found"}
                </p>
                <button
                  onClick={() => navigate(-1)}
                  className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  Go back
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
          <div className="bg-gradient-radial from-primary/5 via-secondary/2 absolute inset-0 to-transparent opacity-50" />

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
                  <span className="from-secondary to-primary bg-gradient-to-r bg-clip-text text-transparent">
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
                    label: "Details",
                    icon: <Info className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "status",
                    label: "Stability",
                    icon: <Check className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "owners",
                    label: "Ownership",
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
                      Component Info
                    </h3>
                    <div>
                      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Type
                      </h4>
                      <div className="mt-1 flex items-start gap-2 text-sm">
                        <Check
                          className="text-primary mt-0.5 h-4 w-4 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-medium capitalize">{component.type}</span>
                          {COMPONENT_TYPE_DESCRIPTIONS[component.type] && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {COMPONENT_TYPE_DESCRIPTIONS[component.type]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Version
                      </h4>
                      <p className="mt-1 text-sm font-medium">{version}</p>
                    </div>
                    <div>
                      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Distribution
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
                      Links & Resources
                    </h3>
                    <a
                      href={`https://github.com/open-telemetry/${component.repository}/tree/main/${component.type}/${component.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border/50 hover:bg-muted/50 group flex items-center gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <GitHubIcon className="text-primary h-5 w-5 transition-transform group-hover:scale-110" />
                      <div>
                        <p className="text-sm font-medium">Source Code</p>
                        <p className="text-muted-foreground text-xs">View on GitHub</p>
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
                  <SectionHeader>Stability Levels</SectionHeader>
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

                  <SectionHeader>Distribution Availability</SectionHeader>
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
                  <p className="text-muted-foreground mt-4">
                    No stability information available for this version.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="owners" className="mt-0 p-6">
              {component.status?.codeowners?.active &&
              component.status.codeowners.active.length > 0 ? (
                <div className="space-y-6">
                  <SectionHeader>Code Owners</SectionHeader>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {component.status.codeowners.active.map((owner: string) => (
                      <DetailCard key={owner} withHoverEffect>
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                            <GitHubIcon className="text-primary h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{owner}</p>
                            <a
                              href={`https://github.com/${owner.replace("@", "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs hover:underline"
                            >
                              View profile
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
                  <p className="text-muted-foreground mt-4">
                    No code owner information found for this component.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  );
}
