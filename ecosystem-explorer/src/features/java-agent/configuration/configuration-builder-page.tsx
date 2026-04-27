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
import { useMemo, useRef, useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
import { ConfigurationTocSidebar, type TocSection } from "./components/configuration-toc-sidebar";
import {
  GeneralSectionCard,
  GENERAL_SECTION_KEY,
  GENERAL_SECTION_LABEL,
} from "./components/general-section-card";
import { useActiveSection } from "./hooks/use-active-section";

const HIDDEN_SDK_KEYS = new Set(["file_format", "instrumentation/development", "distribution"]);

const SDK_GRID = "grid grid-cols-1 gap-6 lg:grid-cols-[256px_1fr_420px] lg:gap-7";
const INSTRUMENTATION_GRID = "grid grid-cols-1 gap-6 lg:grid-cols-[256px_1fr] lg:gap-7";

interface SdkTabContentProps {
  schema: GroupNode;
  starter: ReturnType<typeof useConfigStarter>["data"];
  version: string;
  activeTab: string;
}

function SdkTabContent({ schema, starter, version, activeTab }: SdkTabContentProps) {
  const { groupChildren, leafChildren } = useMemo(() => {
    const visible = schema.children.filter((c) => !HIDDEN_SDK_KEYS.has(c.key));
    return {
      groupChildren: visible.filter((c) => c.controlType === "group"),
      leafChildren: visible.filter((c) => c.controlType !== "group"),
    };
  }, [schema]);
  const hasGeneralLeaves = leafChildren.length > 0;

  const tocSections: TocSection[] = useMemo(() => {
    const groups = groupChildren.map((c) => ({ key: c.key, label: c.label }));
    return hasGeneralLeaves
      ? [{ key: GENERAL_SECTION_KEY, label: GENERAL_SECTION_LABEL }, ...groups]
      : groups;
  }, [groupChildren, hasGeneralLeaves]);
  const sectionKeys = useMemo(() => tocSections.map((s) => s.key), [tocSections]);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const { activeKey, scrollToSection } = useActiveSection(sectionKeys, sectionsContainerRef);

  return (
    <ConfigurationBuilderProvider key={version} schema={schema} version={version} starter={starter}>
      <div className={SDK_GRID}>
        <ConfigurationTocSidebar
          activeTab={activeTab}
          sections={tocSections}
          activeKey={activeKey}
          onSectionClick={scrollToSection}
        />
        <div ref={sectionsContainerRef} className="space-y-4">
          {hasGeneralLeaves && <GeneralSectionCard leafChildren={leafChildren} />}
          {groupChildren.map((child) => (
            <SchemaRenderer key={child.key} node={child} depth={0} path={child.key} />
          ))}
        </div>
        <PreviewCard schema={schema} />
      </div>
    </ConfigurationBuilderProvider>
  );
}

function InstrumentationTabContent({ activeTab }: { activeTab: string }) {
  return (
    <div className={INSTRUMENTATION_GRID}>
      <ConfigurationTocSidebar
        activeTab={activeTab}
        sections={[]}
        activeKey={null}
        onSectionClick={() => {}}
      />
      <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
        Instrumentation browser is coming in a follow-up PR (#250).
      </div>
    </div>
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

  const schema = useConfigSchema(version);
  const starter = useConfigStarter(version);
  const root = (schema.data as GroupNode | null) ?? null;

  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold md:text-4xl">
              <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
                Configuration Builder
              </span>
            </h1>
            <p className="text-base text-muted-foreground">
              Build and customize your OpenTelemetry Java Agent configuration
            </p>
          </div>
          {versions.data && version ? (
            <VersionSelector
              versions={versions.data.versions}
              currentVersion={version}
              onVersionChange={setCurrentVersion}
            />
          ) : null}
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="sdk">
            {schema.loading || starter.loading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading schema…</p>
            ) : schema.error || !root ? (
              <p className="mt-4 text-sm text-red-400">Failed to load schema.</p>
            ) : starter.error ? (
              <p className="mt-4 text-sm text-red-400">Failed to load starter template.</p>
            ) : version ? (
              <SdkTabContent
                schema={root}
                starter={starter.data}
                version={version}
                activeTab={activeTab}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="instrumentation">
            <InstrumentationTabContent activeTab={activeTab} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
