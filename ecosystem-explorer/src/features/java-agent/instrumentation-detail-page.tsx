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
import { useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useVersions, useInstrumentation } from "@/hooks/use-javaagent-data";
import { getInstrumentationDisplayName } from "./utils/format";

export function InstrumentationDetailPage() {
  const { version, name } = useParams<{ version: string; name: string }>();
  const navigate = useNavigate();

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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">Loading instrumentation...</div>
            <div className="text-sm text-muted-foreground">This may take a moment</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !instrumentation) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <BackButton />
        <div className="mt-6 p-6 border border-red-500/50 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
          <h3 className="font-semibold mb-2">Error loading instrumentation</h3>
          <p className="text-sm">{error?.message || "Instrumentation not found"}</p>
        </div>
      </div>
    );
  }

  const displayName = getInstrumentationDisplayName(instrumentation);
  const showRawName =
    instrumentation.display_name && instrumentation.display_name !== instrumentation.name;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <BackButton />

      <div className="mt-6 space-y-6">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
              {showRawName && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <code className="px-2 py-1 bg-muted rounded text-foreground">
                    {instrumentation.name}
                  </code>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground font-medium">Agent Version:</span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                {version}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                {instrumentation.disabled_by_default ? "Disabled by Default" : "Enabled by Default"}
              </span>
            </div>
          </div>

          {instrumentation.description && (
            <p className="text-base text-muted-foreground">{instrumentation.description}</p>
          )}
        </header>

        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
              <h2 className="text-xl font-semibold mb-4">Details</h2>
              <div className="space-y-4">
                {instrumentation.library_link && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Library Link</h3>
                    <a
                      href={instrumentation.library_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {instrumentation.library_link}
                    </a>
                  </div>
                )}

                {instrumentation.source_path && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Source Path</h3>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {instrumentation.source_path}
                    </code>
                  </div>
                )}

                {instrumentation.minimum_java_version && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Minimum Java Version
                    </h3>
                    <p className="text-sm">{instrumentation.minimum_java_version}</p>
                  </div>
                )}

                {instrumentation.has_standalone_library !== undefined && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Standalone Library
                    </h3>
                    <p className="text-sm">
                      {instrumentation.has_standalone_library ? "Yes" : "No"}
                    </p>
                  </div>
                )}

                {instrumentation.javaagent_target_versions &&
                  instrumentation.javaagent_target_versions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        Target Versions
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {instrumentation.javaagent_target_versions.map((targetVersion) => (
                          <span
                            key={targetVersion}
                            className="px-2 py-1 bg-muted text-foreground rounded text-xs"
                          >
                            {targetVersion}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {instrumentation.tags && instrumentation.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {instrumentation.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {instrumentation.features && instrumentation.features.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Features</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {instrumentation.features.map((feature, index) => (
                        <li key={index} className="text-sm">
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {instrumentation.semantic_conventions &&
                  instrumentation.semantic_conventions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        Semantic Conventions
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {instrumentation.semantic_conventions.map((convention) => (
                          <span
                            key={convention}
                            className="px-2 py-1 bg-muted text-foreground rounded text-xs"
                          >
                            {convention}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {instrumentation.scope && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Scope</h3>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Name:</span> {instrumentation.scope.name}
                      </p>
                      {instrumentation.scope.schema_url && (
                        <p className="text-sm">
                          <span className="font-medium">Schema URL:</span>{" "}
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {instrumentation.scope.schema_url}
                          </code>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="telemetry">
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
              <h2 className="text-xl font-semibold mb-4">Telemetry</h2>
              {instrumentation.telemetry && instrumentation.telemetry.length > 0 ? (
                <div className="space-y-6">
                  {instrumentation.telemetry.map((telemetry, index) => (
                    <div
                      key={index}
                      className="border-b border-border/50 pb-6 last:border-b-0 last:pb-0"
                    >
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">When</h3>
                        <p className="text-sm">{telemetry.when}</p>
                      </div>

                      {telemetry.metrics && telemetry.metrics.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-base font-semibold mb-3">Metrics</h3>
                          <div className="space-y-4">
                            {telemetry.metrics.map((metric, metricIndex) => (
                              <div
                                key={metricIndex}
                                className="bg-background/50 rounded-lg p-4 border border-border/30"
                              >
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <code className="text-sm font-mono text-primary">
                                    {metric.name}
                                  </code>
                                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                    {metric.type}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {metric.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Unit:</span> {metric.unit}
                                </p>
                                {metric.attributes && metric.attributes.length > 0 && (
                                  <div className="mt-3">
                                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                                      Attributes
                                    </h4>
                                    <div className="space-y-1">
                                      {metric.attributes.map((attr, attrIndex) => (
                                        <div
                                          key={attrIndex}
                                          className="flex items-center gap-2 text-xs"
                                        >
                                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                            {attr.name}
                                          </code>
                                          <span className="text-muted-foreground">
                                            ({attr.type})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {telemetry.spans && telemetry.spans.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold mb-3">Spans</h3>
                          <div className="space-y-4">
                            {telemetry.spans.map((span, spanIndex) => (
                              <div
                                key={spanIndex}
                                className="bg-background/50 rounded-lg p-4 border border-border/30"
                              >
                                <div className="mb-2">
                                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                    {span.span_kind}
                                  </span>
                                </div>
                                {span.attributes && span.attributes.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                                      Attributes
                                    </h4>
                                    <div className="space-y-1">
                                      {span.attributes.map((attr, attrIndex) => (
                                        <div
                                          key={attrIndex}
                                          className="flex items-center gap-2 text-xs"
                                        >
                                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                            {attr.name}
                                          </code>
                                          <span className="text-muted-foreground">
                                            ({attr.type})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No telemetry information available.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="configuration">
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              {instrumentation.configurations && instrumentation.configurations.length > 0 ? (
                <div className="space-y-4">
                  {instrumentation.configurations.map((config) => (
                    <div
                      key={config.name}
                      className="bg-background/50 rounded-lg p-4 border border-border/30"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <code className="text-sm font-mono text-primary">{config.name}</code>
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                          {config.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{config.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground">Default:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded">
                          {typeof config.default === "boolean"
                            ? config.default.toString()
                            : config.default}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No configuration options available.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
