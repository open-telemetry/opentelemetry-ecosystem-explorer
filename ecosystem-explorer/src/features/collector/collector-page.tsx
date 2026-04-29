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
import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Search,
  Loader2,
  ChevronRight,
  Box,
  Layers,
  Send,
  Plug,
  Workflow,
  ChevronDown,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DetailCard } from "@/components/ui/detail-card";
import { useCollectorVersions, useCollectorComponents } from "@/hooks/use-collector-data";
import { isEnabled } from "@/lib/feature-flags";

export function CollectorPage() {
  const { version: urlVersion } = useParams<{ version: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: versionData, loading: versionsLoading } = useCollectorVersions();

  const currentVersion = useMemo(() => {
    if (urlVersion) return urlVersion;
    return versionData?.versions.find((v) => v.is_latest)?.version || "";
  }, [urlVersion, versionData]);

  const { data: components, loading: componentsLoading } = useCollectorComponents(currentVersion);

  const filteredComponents = useMemo(() => {
    if (!components) return [];

    return components.filter((comp) => {
      const matchesSearch =
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || comp.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [components, searchQuery, typeFilter]);

  const handleVersionChange = (val: string) => {
    navigate(`/collector/components/${val}`);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "receiver":
        return <Box className="h-4 w-4" aria-hidden="true" />;
      case "processor":
        return <Layers className="h-4 w-4" aria-hidden="true" />;
      case "exporter":
        return <Send className="h-4 w-4" aria-hidden="true" />;
      case "extension":
        return <Plug className="h-4 w-4" aria-hidden="true" />;
      case "connector":
        return <Workflow className="h-4 w-4" aria-hidden="true" />;
      default:
        return <Box className="h-4 w-4" aria-hidden="true" />;
    }
  };

  return (
    <PageContainer>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            Collector{" "}
            <span className="from-secondary to-primary bg-gradient-to-r bg-clip-text text-transparent">
              Components
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
            Navigate the OpenTelemetry Collector ecosystem. Discover receivers, processors,
            exporters, and extensions across different distributions.
          </p>
        </header>

        {!isEnabled("COLLECTOR_PAGE") ? (
          <div className="border-border/40 bg-card/30 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center backdrop-blur-sm">
            <div className="bg-primary/10 mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full">
              <Box className="text-primary h-10 w-10 animate-pulse" aria-hidden="true" />
            </div>
            <h2 className="text-foreground text-2xl font-bold tracking-tight">Coming Soon</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-lg leading-relaxed">
              We're currently building the Collector component explorer. Stay tuned for a
              comprehensive view of receivers, processors, and more!
            </p>
          </div>
        ) : (
          <>
            <div className="border-border/60 bg-card/80 relative overflow-hidden rounded-xl border p-6">
          <div className="bg-gradient-radial from-secondary/5 via-primary/2 absolute inset-0 to-transparent opacity-50" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="search" className="text-muted-foreground text-sm font-medium">
                Search
              </label>
              <div className="relative">
                <Search
                  className="text-muted-foreground/60 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="search"
                  type="text"
                  placeholder="Filter by name or description..."
                  className="border-border/60 bg-background/80 focus:border-primary/50 focus:ring-primary/20 w-full rounded-lg border py-2.5 pr-4 pl-10 text-sm backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <label htmlFor="type-filter" className="text-muted-foreground text-sm font-medium">
                  Type
                </label>
                <div className="relative">
                  <select
                    id="type-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="border-border/60 bg-background/80 focus:border-primary/50 focus:ring-primary/20 w-[160px] cursor-pointer appearance-none rounded-lg border py-2.5 pr-10 pl-3 text-sm font-medium backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="receiver">Receivers</option>
                    <option value="processor">Processors</option>
                    <option value="exporter">Exporters</option>
                    <option value="extension">Extensions</option>
                    <option value="connector">Connectors</option>
                  </select>
                  <ChevronDown
                    className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="version-select"
                  className="text-muted-foreground text-sm font-medium"
                >
                  Version
                </label>
                <div className="relative">
                  <select
                    id="version-select"
                    value={currentVersion}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    disabled={versionsLoading}
                    className="border-border/60 bg-background/80 focus:border-primary/50 focus:ring-primary/20 w-[160px] cursor-pointer appearance-none rounded-lg border py-2.5 pr-10 pl-3 text-sm font-medium backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none disabled:opacity-50"
                  >
                    {versionData?.versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version} {v.is_latest ? "(latest)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {componentsLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-32">
            <div className="inline-flex animate-pulse rounded-full p-4 shadow-[0_0_60px_hsl(var(--primary-hsl)/0.2)]">
              <Loader2 className="text-primary h-10 w-10 animate-spin" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">Loading components...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border-border/40 flex items-center justify-between border-b pb-4">
              <div className="text-muted-foreground text-sm font-medium">
                Showing <span className="text-foreground">{filteredComponents.length}</span>{" "}
                components
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredComponents.length > 0 ? (
                filteredComponents.map((comp) => (
                  <Link
                    key={comp.id}
                    to={`/collector/components/${currentVersion}/${comp.id}`}
                    className="group focus-visible:ring-primary block rounded-xl outline-none focus-visible:ring-2"
                  >
                    <DetailCard
                      withHoverEffect
                      className="border-border/50 group-hover:border-primary/30 h-full transition-colors"
                    >
                      <div className="flex h-full flex-col space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110">
                              {getIcon(comp.type)}
                            </div>
                            <div className="space-y-1">
                              <GlowBadge
                                variant="muted"
                                className="text-[10px] font-bold tracking-widest uppercase"
                              >
                                {comp.type}
                              </GlowBadge>
                            </div>
                          </div>
                          <ChevronRight
                            className="text-muted-foreground/40 h-5 w-5 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="group-hover:text-primary text-lg leading-tight font-bold transition-colors">
                            {comp.display_name || comp.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <code className="text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 font-mono text-[11px]">
                              {comp.name}
                            </code>
                            <span className="text-muted-foreground/60 text-[10px] font-medium tracking-tighter uppercase">
                              {comp.distribution}
                            </span>
                          </div>
                        </div>

                        <p className="text-muted-foreground/80 line-clamp-3 flex-1 text-sm leading-relaxed">
                          {comp.description ||
                            "Browse technical details and configuration options for this component."}
                        </p>

                        <div className="border-border/10 flex items-center gap-2 border-t pt-2">
                          {comp.status?.stability &&
                            Object.keys(comp.status.stability).length > 0 && (
                              <GlowBadge
                                variant={
                                  Object.keys(comp.status.stability)[0] === "stable"
                                    ? "success"
                                    : "info"
                                }
                                className="px-2 py-0 text-[9px]"
                              >
                                {Object.keys(comp.status.stability)[0]}
                              </GlowBadge>
                            )}
                        </div>
                      </div>
                    </DetailCard>
                  </Link>
                ))
              ) : (
                <div className="border-border/40 col-span-full rounded-2xl border-2 border-dashed py-32 text-center">
                  <div className="bg-muted/10 mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
                    <Search className="text-muted-foreground/30 h-8 w-8" aria-hidden="true" />
                  </div>
                  <h3 className="text-foreground text-xl font-semibold">No components found</h3>
                  <p className="text-muted-foreground mx-auto mt-2 max-w-xs">
                    We couldn't find any components matching your search criteria.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                    }}
                    className="text-primary mt-6 text-sm font-semibold hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )}
  </div>
</PageContainer>
  );
}
