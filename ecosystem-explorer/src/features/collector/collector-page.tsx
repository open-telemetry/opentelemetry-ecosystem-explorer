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
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Collector{" "}
            <span className="bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
              Components
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Navigate the OpenTelemetry Collector ecosystem. Discover receivers, processors,
            exporters, and extensions across different distributions.
          </p>
        </header>

        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/80 p-6">
          <div className="absolute inset-0 bg-gradient-radial from-secondary/5 via-primary/2 to-transparent opacity-50" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="search" className="text-sm font-medium text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <input
                  id="search"
                  type="text"
                  placeholder="Filter by name or description..."
                  className="w-full rounded-lg border border-border/60 bg-background/80 pl-10 pr-4 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <label htmlFor="type-filter" className="text-sm font-medium text-muted-foreground">
                  Type
                </label>
                <div className="relative">
                  <select
                    id="type-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="appearance-none w-[160px] rounded-lg border border-border/60 bg-background/80 pl-3 pr-10 py-2.5 text-sm font-medium backdrop-blur-sm transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="receiver">Receivers</option>
                    <option value="processor">Processors</option>
                    <option value="exporter">Exporters</option>
                    <option value="extension">Extensions</option>
                    <option value="connector">Connectors</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="version-select"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Version
                </label>
                <div className="relative">
                  <select
                    id="version-select"
                    value={currentVersion}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    disabled={versionsLoading}
                    className="appearance-none w-[160px] rounded-lg border border-border/60 bg-background/80 pl-3 pr-10 py-2.5 text-sm font-medium backdrop-blur-sm transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50"
                  >
                    {versionData?.versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version} {v.is_latest ? "(latest)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>


        {componentsLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="inline-flex rounded-full p-4 animate-pulse shadow-[0_0_60px_hsl(var(--primary-hsl)/0.2)]">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Loading components...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="text-sm text-muted-foreground font-medium">
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
                    className="group block outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                  >
                    <DetailCard
                      withHoverEffect
                      className="h-full border-border/50 group-hover:border-primary/30 transition-colors"
                    >
                      <div className="flex flex-col h-full space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                              {getIcon(comp.type)}
                            </div>
                            <div className="space-y-1">
                              <GlowBadge
                                variant="muted"
                                className="text-[10px] uppercase tracking-widest font-bold"
                              >
                                {comp.type}
                              </GlowBadge>
                            </div>
                          </div>
                          <ChevronRight
                            className="h-5 w-5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                            {comp.display_name || comp.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <code className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {comp.name}
                            </code>
                            <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-tighter">
                              {comp.distribution}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground/80 line-clamp-3 leading-relaxed flex-1">
                          {comp.description ||
                            "Browse technical details and configuration options for this component."}
                        </p>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/10">
                          {comp.status?.stability &&
                            Object.keys(comp.status.stability).length > 0 && (
                              <GlowBadge
                                variant={
                                  Object.keys(comp.status.stability)[0] === "stable"
                                    ? "success"
                                    : "info"
                                }
                                className="text-[9px] px-2 py-0"
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
                <div className="col-span-full py-32 text-center border-2 border-dashed border-border/40 rounded-2xl">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted/10 mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/30" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">No components found</h3>
                  <p className="mt-2 text-muted-foreground max-w-xs mx-auto">
                    We couldn't find any components matching your search criteria.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                    }}
                    className="mt-6 text-sm font-semibold text-primary hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
