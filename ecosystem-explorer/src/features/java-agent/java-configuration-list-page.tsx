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
import { useState, useMemo, useEffect } from "react";
import { Search, Settings, Loader2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";
import { Tabs } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { ConfigurationCard, type ConfigurationFormat } from "./components/configuration-card";
import type { Configuration } from "@/types/javaagent";
import { loadGlobalConfigurations } from "@/lib/api/javaagent-data";

interface GlobalConfiguration extends Configuration {
  instrumentations?: string[];
}

const FORMAT_TABS = [
  { value: "system-property", label: "System Properties" },
  { value: "declarative", label: "Declarative Configuration" },
];

function useGlobalConfigurations() {
  const [data, setData] = useState<GlobalConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGlobalConfigurations()
      .then((configs: unknown) => {
        setData(configs as GlobalConfiguration[]);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch configurations:", err);
        setError("Configuration data could not be loaded. Please try again later.");
        setIsLoading(false);
      });
  }, []);

  return { data, isLoading, error };
}

export function JavaConfigurationListPage() {
  const [format, setFormat] = useState<ConfigurationFormat>("declarative");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allConfigurations, isLoading, error } = useGlobalConfigurations();

  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return allConfigurations;

    const query = searchQuery.toLowerCase();
    return allConfigurations.filter((config) => {
      const nameMatch = config.name.toLowerCase().includes(query);
      const descMatch = config.description?.toLowerCase().includes(query) ?? false;
      const declMatch = config.declarative_name?.toLowerCase().includes(query) ?? false;
      const instMatch =
        config.instrumentations?.some((inst) => inst.toLowerCase().includes(query)) ?? false;

      return nameMatch || descMatch || declMatch || instMatch;
    });
  }, [allConfigurations, searchQuery]);

  return (
    <PageContainer>
      <BackButton />

      <div className="mt-3 space-y-6">
        <header className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-5 sm:p-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, hsl(var(--primary-hsl) / 0.06) 0%, hsl(var(--secondary-hsl) / 0.03) 40%, transparent 70%)",
            }}
          />
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="text-2xl leading-tight font-bold sm:text-3xl md:text-4xl">
                  <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
                    Configuration Options Explorer
                  </span>
                </h1>
                <p className="text-muted-foreground max-w-4xl text-base leading-relaxed">
                  Explore all configuration options across instrumentations. Search by normal name,
                  declarative representation, or description.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="border-border/60 bg-card/80 relative space-y-6 rounded-lg border p-4 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search configurations"
                placeholder="Search configurations, descriptions, or instrumentations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border bg-background focus:border-primary focus:ring-primary w-full rounded-md border py-2 pr-4 pl-10 text-sm focus:ring-1 focus:outline-none"
              />
            </div>

            <div className="w-full shrink-0 md:w-auto">
              <Tabs value={format} onValueChange={(v) => setFormat(v as ConfigurationFormat)}>
                <SegmentedTabList tabs={FORMAT_TABS} value={format} fullWidth={false} />
              </Tabs>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-muted-foreground mb-4 text-sm">
              {isLoading
                ? "Loading..."
                : error
                  ? "Unable to load configurations"
                  : `Found ${filteredConfigs.length} configurations`}
            </div>

            {isLoading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <Loader2
                    className="text-primary mx-auto h-12 w-12 animate-spin"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground mt-4 text-sm">Loading configurations...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed">
                <div className="mx-auto max-w-md px-4 text-center">
                  <Settings className="text-destructive/50 mx-auto h-12 w-12" aria-hidden="true" />
                  <p className="text-muted-foreground mt-4 text-sm font-medium">{error}</p>
                </div>
              </div>
            ) : filteredConfigs.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <Search
                    className="text-muted-foreground/50 mx-auto h-12 w-12"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground mt-4 text-sm">
                    No configurations found matching your search.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredConfigs.map((config) => (
                  <ConfigurationCard
                    key={config.name}
                    config={config}
                    format={format}
                    instrumentations={config.instrumentations}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
