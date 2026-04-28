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
import { Info, ExternalLink, Code, AlertCircle, Loader2, Check, Users } from "lucide-react";
import { GitHubIcon } from "@/components/icons/github-icon";

import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DetailCard } from "@/components/ui/detail-card";
import { SectionHeader } from "@/components/ui/section-header";
import { PageContainer } from "@/components/layout/page-container";
import { useCollectorComponent } from "@/hooks/use-collector-data";

export function CollectorDetailPage() {
  const { version, name } = useParams<{ version: string; name: string }>();
  const navigate = useNavigate();
  const { data: component, loading, error } = useCollectorComponent(name ?? "", version ?? "");

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="inline-flex rounded-full p-4 animate-pulse shadow-[0_0_60px_hsl(var(--primary-hsl)/0.2)]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden="true" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="text-lg font-medium text-foreground">Loading component...</div>
              <div className="text-sm text-muted-foreground">This may take a moment</div>
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
                  className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
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

  const repositoryUrl = component.repository
    ? `https://github.com/open-telemetry/${component.repository}`
    : "https://github.com/open-telemetry/opentelemetry-collector-contrib";

  return (
    <PageContainer>
      <BackButton />

      <div className="mt-3 space-y-6">
        <header className="relative overflow-hidden rounded-lg border border-border/60 bg-card/80 p-8">
          <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-secondary/2 to-transparent opacity-50" />

          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full bg-[linear-gradient(hsl(var(--border-hsl))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border-hsl))_1px,transparent_1px)] bg-[size:32px_32px]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <GlowBadge variant="info" className="uppercase tracking-wider text-[10px]">
                    {component.component_type}
                  </GlowBadge>
                  <GlowBadge variant="muted" className="uppercase tracking-wider text-[10px]">
                    {component.distribution}
                  </GlowBadge>
                </div>
                <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                  <span className="bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                    {component.display_name || component.name}
                  </span>
                </h1>
                <p className="text-sm">
                  <code className="rounded bg-muted px-2 py-1 text-foreground/80">
                    {component.name}
                  </code>
                </p>
              </div>
            </div>

            {component.description && (
              <p className="max-w-4xl text-base leading-relaxed text-muted-foreground">
                {component.description}
              </p>
            )}
          </div>
        </header>

        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/80">
          <Tabs defaultValue="details" className="relative z-10">
            <div className="px-6 pt-4">
              <SegmentedTabList
                value="details"
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
                    <h3 className="font-semibold text-lg border-b border-border/50 pb-2 mb-4">
                      Component Info
                    </h3>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Type
                      </h4>
                      <p className="mt-1 text-sm font-medium">{component.type || component.name}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Version
                      </h4>
                      <p className="mt-1 text-sm font-medium">{component.version}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                    <h3 className="font-semibold text-lg border-b border-border/50 pb-2 mb-4">
                      Links & Resources
                    </h3>
                    <a
                      href={repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                    >
                      <GitHubIcon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-medium">Source Code</p>
                        <p className="text-xs text-muted-foreground">View on GitHub</p>
                      </div>
                      <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
                    </a>

                    <a
                      href={`${repositoryUrl}/tree/main/${component.component_type}/${component.type || component.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                    >
                      <Code className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-medium">Component Documentation</p>
                        <p className="text-xs text-muted-foreground">Read the README</p>
                      </div>
                      <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
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
                            className="capitalize"
                          >
                            {level}
                          </GlowBadge>
                          <div className="flex flex-wrap gap-2">
                            {signals.map((signal) => (
                              <span
                                key={signal}
                                className="text-sm px-2 py-1 rounded bg-muted/50 font-medium"
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
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">
                    No stability information available for this version.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="owners" className="mt-0 p-6">
              {component.codeowners &&
              (component.codeowners.active?.length || component.codeowners.emeritus?.length) ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {component.codeowners.active && component.codeowners.active.length > 0 && (
                    <div>
                      <SectionHeader>Active Maintainers</SectionHeader>
                      <div className="space-y-2">
                        {component.codeowners.active.map((owner) => (
                          <a
                            key={owner}
                            href={`https://github.com/${owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors"
                          >
                            <img
                              src={`https://github.com/${owner}.png?size=40`}
                              alt={owner}
                              className="h-8 w-8 rounded-full border border-border"
                            />
                            <span className="font-medium">@{owner}</span>
                            <ExternalLink className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {component.codeowners.emeritus && component.codeowners.emeritus.length > 0 && (
                    <div>
                      <SectionHeader>Emeritus Maintainers</SectionHeader>
                      <div className="space-y-2">
                        {component.codeowners.emeritus.map((owner) => (
                          <div
                            key={owner}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/10 bg-muted/10 opacity-60"
                          >
                            <img
                              src={`https://github.com/${owner}.png?size=40`}
                              alt={owner}
                              className="h-8 w-8 rounded-full grayscale"
                            />
                            <span className="text-sm font-medium">@{owner}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">
                    No maintainer information found in this registry entry.
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
