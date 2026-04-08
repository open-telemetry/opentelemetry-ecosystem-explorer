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
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function ConfigurationBuilderPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <BackButton />
          {/* Version Dropdown - not hooked up yet */}
          <div className="flex items-center gap-2">
            <label htmlFor="java-agent-version" className="text-sm text-foreground">
              Version
            </label>
            <select
              id="java-agent-version"
              className="rounded-md border border-border/50 bg-card/80 px-3 py-2 text-sm text-foreground"
            >
              <option>2.25.0 (latest)</option>
            </select>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Configuration Builder</h1>
          <p className="text-muted-foreground">
            Build and customize your OpenTelemetry Java Agent configuration
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sdk">
          <TabsList>
            <TabsTrigger value="sdk">SDK</TabsTrigger>
            <TabsTrigger value="instrumentation">Instrumentation</TabsTrigger>
          </TabsList>

          <TabsContent value="sdk">
            <div className="mt-4 grid grid-cols-2 gap-6">
              {/* Left Column - Controls */}
              <div className="rounded-lg border border-border/50 bg-card/50 p-6 min-h-96">
                <p className="text-muted-foreground text-sm">SDK controls will appear here</p>
              </div>

              {/* Right Column - Output Preview */}
              <div className="rounded-lg border border-border/50 bg-card/50 p-6 min-h-96">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground">Output Preview</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-border/50 bg-card px-3 py-1 text-sm text-foreground hover:bg-card/80"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-border/50 bg-card px-3 py-1 text-sm text-foreground hover:bg-card/80"
                    >
                      Download
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">YAML output will appear here</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="instrumentation">
            <div className="mt-4 grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="rounded-lg border border-border/50 bg-card/50 p-6 min-h-96">
                <p className="text-muted-foreground text-sm">
                  Instrumentation controls will appear here
                </p>
              </div>

              {/* Right Column */}
              <div className="rounded-lg border border-border/50 bg-card/50 p-6 min-h-96">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground">Output Preview</h3>
                  <div className="flex gap-2">
                    <button className="rounded-md border border-border/50 bg-card px-3 py-1 text-sm text-foreground hover:bg-card/80">
                      Copy
                    </button>
                    <button className="rounded-md border border-border/50 bg-card px-3 py-1 text-sm text-foreground hover:bg-card/80">
                      Download
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">YAML output will appear here</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
