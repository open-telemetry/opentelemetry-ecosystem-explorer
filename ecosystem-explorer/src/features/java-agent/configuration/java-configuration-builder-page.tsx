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
import { useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
import { useVersions } from "@/hooks/use-javaagent-data";
import { ConfigurationBuilderProvider } from "./context/configuration-builder-context.tsx";
import { useConfigurationBuilder } from "./hooks/use-configuration-builder";
import { InstrumentationBrowser } from "./components/instrumentation-browser";
import { OutputPreview } from "./components/output-preview";

function ConfigurationBuilderContent() {
  const { data: versionsData, loading: versionsLoading } = useVersions();
  const { state, dispatch } = useConfigurationBuilder();

  const latestVersion = versionsData?.versions.find((v) => v.is_latest)?.version ?? "";

  useEffect(() => {
    if (latestVersion && !state.version) {
      dispatch({ type: "SET_VERSION", version: latestVersion });
    }
  }, [latestVersion, state.version, dispatch]);

  if (versionsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto px-6 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <BackButton />
          <div className="flex items-center gap-4">
            <label htmlFor="version-select" className="text-sm font-medium">
              Version:
            </label>
            <select
              id="version-select"
              value={state.version}
              onChange={(e) => dispatch({ type: "SET_VERSION", version: e.target.value })}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              aria-label="Select Java Agent version"
            >
              {versionsData?.versions.map((version) => (
                <option key={version.version} value={version.version}>
                  {version.version}
                  {version.is_latest ? " (latest)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Configuration Builder</h1>
          <p className="text-muted-foreground">
            Build and customize your OpenTelemetry Java Agent configuration
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Configuration areas"
          className="flex gap-2 border-b border-border"
        >
          <button
            role="tab"
            aria-selected={state.activeArea === "instrumentation"}
            aria-controls="instrumentation-panel"
            onClick={() => dispatch({ type: "SET_ACTIVE_AREA", area: "instrumentation" })}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              state.activeArea === "instrumentation"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Instrumentation
          </button>
          <button
            role="tab"
            aria-selected={state.activeArea === "sdk"}
            aria-controls="sdk-panel"
            aria-disabled="true"
            disabled
            className="px-4 py-2 font-medium border-b-2 border-transparent text-muted-foreground/50 cursor-not-allowed"
          >
            SDK (Coming Soon)
          </button>
        </div>

        {state.activeArea === "instrumentation" && (
          <div
            id="instrumentation-panel"
            role="tabpanel"
            aria-labelledby="instrumentation-tab"
            className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-6 min-h-[600px]"
          >
            <div className="border border-border rounded-lg bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Instrumentation Browser</h2>
              <InstrumentationBrowser />
            </div>

            <div className="border border-border rounded-lg bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Output Preview</h2>
              <OutputPreview />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function JavaConfigurationBuilderPage() {
  return (
    <ConfigurationBuilderProvider>
      <ConfigurationBuilderContent />
    </ConfigurationBuilderProvider>
  );
}
