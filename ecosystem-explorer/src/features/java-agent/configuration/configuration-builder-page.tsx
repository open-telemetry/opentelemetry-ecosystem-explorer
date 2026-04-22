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
import { useMemo, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { VersionSelector } from "@/features/java-agent/components/version-selector";
import {
  useConfigVersions,
  useConfigSchema,
  useConfigStarter,
} from "@/hooks/use-configuration-data";
import { ConfigurationBuilderProvider } from "@/hooks/configuration-builder-provider";
import type { GroupNode } from "@/types/configuration";
import { SchemaRenderer } from "./components/schema-renderer";
import { PreviewCard } from "./components/preview-card";

function SdkTab({ version }: { version: string }) {
  const schema = useConfigSchema(version);
  const starter = useConfigStarter(version);

  if (schema.loading || starter.loading) {
    return <p className="mt-4 text-sm text-muted-foreground">Loading schema…</p>;
  }
  if (schema.error || !schema.data) {
    return <p className="mt-4 text-sm text-red-400">Failed to load schema.</p>;
  }
  if (starter.error) {
    return <p className="mt-4 text-sm text-red-400">Failed to load starter template.</p>;
  }

  const root = schema.data as GroupNode;
  const visibleChildren = root.children.filter((c) => c.key !== "file_format");
  const groupChildren = visibleChildren.filter((c) => c.controlType === "group");
  const leafChildren = visibleChildren.filter((c) => c.controlType !== "group");

  return (
    <ConfigurationBuilderProvider
      key={version}
      schema={schema.data}
      version={version}
      starter={starter.data}
    >
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {leafChildren.length > 0 && (
            <section className="rounded-xl border border-border/50 bg-card/40 p-5 space-y-3">
              <h3 className="text-base font-semibold text-foreground">General</h3>
              {leafChildren.map((child) => (
                <SchemaRenderer key={child.key} node={child} depth={1} path={child.key} />
              ))}
            </section>
          )}
          {groupChildren.map((child) => (
            <SchemaRenderer key={child.key} node={child} depth={0} path={child.key} />
          ))}
        </div>
        <PreviewCard schema={schema.data} />
      </div>
    </ConfigurationBuilderProvider>
  );
}

export function ConfigurationBuilderPage() {
  const versions = useConfigVersions();
  const latest = useMemo(
    () =>
      versions.data?.versions.find((v) => v.is_latest)?.version ??
      versions.data?.versions[0]?.version ??
      "",
    [versions.data]
  );
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const version = currentVersion || latest;
  const [activeTab, setActiveTab] = useState("sdk");

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-6">
        <div className="flex items-center">
          <BackButton />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Configuration Builder</h1>
          <p className="text-muted-foreground">
            Build and customize your OpenTelemetry Java Agent configuration
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <SegmentedTabList
            value={activeTab}
            tabs={[
              { value: "sdk", label: "SDK" },
              { value: "instrumentation", label: "Instrumentation" },
            ]}
          />
          <TabsContent value="sdk">
            <div className="mt-4 flex items-center justify-end">
              {versions.data && version ? (
                <VersionSelector
                  versions={versions.data.versions}
                  currentVersion={version}
                  onVersionChange={setCurrentVersion}
                  label="Schema version"
                  id="config-schema-version"
                />
              ) : null}
            </div>
            {version ? <SdkTab version={version} /> : null}
          </TabsContent>
          <TabsContent value="instrumentation">
            <div className="mt-4 rounded-xl border border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              Instrumentation browser is coming in a follow-up PR (#250).
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
