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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { BackButton } from "@/components/ui/back-button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { PageContainer } from "@/components/layout/page-container";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { VersionSelector } from "@/features/java-agent/components/version-selector";
import {
  useConfigVersions,
  useConfigSchema,
  useConfigStarter,
} from "@/hooks/use-configuration-data";
import { ConfigurationBuilderProvider } from "@/hooks/configuration-builder-provider";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { useInstrumentations, useVersions } from "@/hooks/use-javaagent-data";
import { groupByModule } from "@/lib/normalize-instrumentation";
import { useCustomizedModules } from "@/hooks/use-customized-modules";
import type { GroupNode } from "@/types/configuration";
import { hasMeaningfulLeaf } from "@/lib/state-hydrate";
import { SchemaRenderer } from "./components/schema-renderer";
import { PreviewCard } from "./components/preview-card";
import {
  ConfigurationTocSidebar,
  type StatusFilter,
  type TocSection,
} from "./components/configuration-toc-sidebar";
import { GeneralSectionCard, GENERAL_SECTION_KEY } from "./components/general-section-card";
import { InstrumentationBrowser } from "./components/instrumentation-browser";
import { useActiveSection } from "./hooks/use-active-section";
import {
  SectionExpansionProvider,
  useSectionExpansion,
} from "./components/section-expansion-context";

// Per-tab hidden-keys: SDK hides the entire `instrumentation/development`
// subtree (the Instrumentation tab owns it), while the Instrumentation tab
// only hides the always-synthetic top-level keys. The Instrumentation tab
// renders explicitly-picked subtrees, so HIDDEN_KEYS_BY_TAB.instrumentation
// is currently advisory; it pins the asymmetry for future call sites.
const HIDDEN_KEYS_BY_TAB = {
  sdk: new Set(["file_format", "instrumentation/development", "distribution"]),
  instrumentation: new Set(["file_format", "distribution"]),
};
const SDK_HIDDEN_KEYS = HIDDEN_KEYS_BY_TAB.sdk;

// Both tabs render a 3-column shell (sidebar / content / live preview).
// `minmax(0, 1fr)` overrides Grid's default `min-width: auto` on the middle
// track so long descendant content (instrumentation IDs, code spans) cannot
// expand the column past its 1fr share. Without it the third column gets
// pushed off-screen.
const BUILDER_GRID = "grid grid-cols-1 gap-6 lg:grid-cols-[256px_minmax(0,1fr)_420px] lg:gap-7";

const INSTRUMENTATION_DEV_KEY = "instrumentation/development";
const GENERAL_SUBKEY = "general";
const INSTRUMENTATIONS_SECTION_KEY = "instrumentations";

// Drops instrumentation customizations that reference modules not present in the
// selected agent version. Without this, switching from a newer agent (where a
// module exists) to an older one would leak orphan entries into the YAML output.
function PruneInstrumentationsForAgentVersion({ javaAgentVersion }: { javaAgentVersion: string }) {
  const { pruneInstrumentations } = useConfigurationBuilder();
  const { data } = useInstrumentations(javaAgentVersion);
  useEffect(() => {
    if (!data) return;
    pruneInstrumentations(groupByModule(data).map((m) => m.name));
  }, [data, pruneInstrumentations]);
  return null;
}

const EXPAND_TOOLBAR_BUTTON =
  "border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

function ExpandCollapseToolbar() {
  const { expandAll, collapseAll } = useSectionExpansion();
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={expandAll} className={EXPAND_TOOLBAR_BUTTON}>
        <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
        Expand all
      </button>
      <button type="button" onClick={collapseAll} className={EXPAND_TOOLBAR_BUTTON}>
        <ChevronsDownUp className="h-3 w-3" aria-hidden="true" />
        Collapse all
      </button>
    </div>
  );
}

interface SdkTabContentProps {
  schema: GroupNode;
  starter: ReturnType<typeof useConfigStarter>["data"];
  schemaVersion: string;
  javaAgentVersion: string;
  activeTab: string;
}

function SdkTabContent({
  schema,
  starter,
  schemaVersion,
  javaAgentVersion,
  activeTab,
}: SdkTabContentProps) {
  const { t } = useTranslation("java-agent");
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);

  const handleInteraction = (e: React.BaseSyntheticEvent) => {
    const target = e.target as HTMLElement;
    const leafKey = target
      .closest("[data-yaml-section-key]")
      ?.getAttribute("data-yaml-section-key");
    const sectionKey = target.closest("[data-section-key]")?.getAttribute("data-section-key");
    const key = leafKey ?? sectionKey;
    if (key && key !== activePreviewKey) {
      setActivePreviewKey(key);
    }
  };

  const { groupChildren, leafChildren } = useMemo(() => {
    const visible = schema.children.filter((c) => !SDK_HIDDEN_KEYS.has(c.key));
    return {
      groupChildren: visible.filter((c) => c.controlType === "group"),
      leafChildren: visible.filter((c) => c.controlType !== "group"),
    };
  }, [schema]);
  const hasGeneralLeaves = leafChildren.length > 0;

  const tocSections: TocSection[] = useMemo(() => {
    const groups = groupChildren.map((c) => ({ key: c.key, label: c.label }));
    return hasGeneralLeaves
      ? [{ key: GENERAL_SECTION_KEY, label: t("builder.general.label") }, ...groups]
      : groups;
  }, [groupChildren, hasGeneralLeaves, t]);
  const sectionKeys = useMemo(() => tocSections.map((s) => s.key), [tocSections]);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const { activeKey, scrollToSection } = useActiveSection(sectionKeys, sectionsContainerRef);

  return (
    <ConfigurationBuilderProvider
      key={schemaVersion}
      schema={schema}
      version={schemaVersion}
      starter={starter}
    >
      <PruneInstrumentationsForAgentVersion javaAgentVersion={javaAgentVersion} />
      <SectionExpansionProvider>
        <div className={BUILDER_GRID}>
          <ConfigurationTocSidebar
            activeTab={activeTab}
            sections={tocSections}
            activeKey={activeKey}
            onSectionClick={scrollToSection}
          />
          <div className="space-y-4">
            <div className="flex justify-end">
              <ExpandCollapseToolbar />
            </div>
            <div
              ref={sectionsContainerRef}
              className="space-y-4"
              onFocusCapture={handleInteraction}
              onPointerDown={handleInteraction}
            >
              {hasGeneralLeaves && (
                <GeneralSectionCard label={t("builder.general.label")}>
                  {leafChildren}
                </GeneralSectionCard>
              )}
              {groupChildren.map((child) => (
                <SchemaRenderer key={child.key} node={child} depth={0} path={child.key} />
              ))}
            </div>
          </div>
          <PreviewCard
            schema={schema}
            javaAgentVersion={javaAgentVersion}
            activePreviewKey={activePreviewKey}
          />
        </div>
      </SectionExpansionProvider>
    </ConfigurationBuilderProvider>
  );
}

interface InstrumentationTabContentProps {
  schema: GroupNode;
  starter: ReturnType<typeof useConfigStarter>["data"];
  schemaVersion: string;
  javaAgentVersion: string;
  activeTab: string;
}

function InstrumentationTabContent({
  schema,
  starter,
  schemaVersion,
  javaAgentVersion,
  activeTab,
}: InstrumentationTabContentProps) {
  const generalNode = useMemo<GroupNode | null>(() => {
    const devNode = schema.children.find((c) => c.key === INSTRUMENTATION_DEV_KEY);
    if (!devNode || devNode.controlType !== "group") return null;
    const general = devNode.children.find((c) => c.key === GENERAL_SUBKEY);
    if (!general || general.controlType !== "group") return null;
    return general;
  }, [schema]);

  return (
    <ConfigurationBuilderProvider
      key={schemaVersion}
      schema={schema}
      version={schemaVersion}
      starter={starter}
    >
      <InstrumentationTabBody
        activeTab={activeTab}
        schema={schema}
        generalNode={generalNode}
        javaAgentVersion={javaAgentVersion}
      />
    </ConfigurationBuilderProvider>
  );
}

interface InstrumentationTabBodyProps {
  activeTab: string;
  schema: GroupNode;
  generalNode: GroupNode | null;
  javaAgentVersion: string;
}

function InstrumentationTabBody({
  activeTab,
  schema,
  generalNode,
  javaAgentVersion,
}: InstrumentationTabBodyProps) {
  const { t } = useTranslation("java-agent");
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const handleInteraction = (e: React.BaseSyntheticEvent) => {
    const target = e.target as HTMLElement;

    const leafKey = target
      .closest("[data-yaml-section-key]")
      ?.getAttribute("data-yaml-section-key");

    const sectionKey = target.closest("[data-section-key]")?.getAttribute("data-section-key");

    const key = leafKey ?? sectionKey;

    if (key && key !== activePreviewKey) {
      setActivePreviewKey(key);
    }
  };

  const tocSections: TocSection[] = useMemo(
    () => [
      { key: GENERAL_SECTION_KEY, label: t("builder.sections.generalSettings") },
      { key: INSTRUMENTATIONS_SECTION_KEY, label: t("builder.sections.instrumentations") },
    ],
    [t]
  );
  const sectionKeys = useMemo(() => tocSections.map((s) => s.key), [tocSections]);
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const { activeKey, scrollToSection } = useActiveSection(sectionKeys, sectionsContainerRef);

  const { state, setEnabled, pruneInstrumentations } = useConfigurationBuilder();

  const instrumentationsState = useInstrumentations(javaAgentVersion);
  const modules = useMemo(
    () => (instrumentationsState.data ? groupByModule(instrumentationsState.data) : []),
    [instrumentationsState.data]
  );
  const customizedSet = useCustomizedModules(modules);
  const customizationCount = customizedSet.size;

  useEffect(() => {
    if (!instrumentationsState.data) return;
    pruneInstrumentations(modules.map((m) => m.name));
  }, [instrumentationsState.data, modules, pruneInstrumentations]);

  const devSection = state.values[INSTRUMENTATION_DEV_KEY];
  const hasDevContent = useMemo(() => hasMeaningfulLeaf(devSection), [devSection]);
  const isDevEnabled = state.enabledSections[INSTRUMENTATION_DEV_KEY] === true;
  useEffect(() => {
    if (hasDevContent && !isDevEnabled) {
      setEnabled(INSTRUMENTATION_DEV_KEY, true);
    }
  }, [hasDevContent, isDevEnabled, setEnabled]);

  const distributionSection = state.values["distribution"];
  const hasDistributionContent = useMemo(
    () => hasMeaningfulLeaf(distributionSection),
    [distributionSection]
  );
  const isDistributionEnabled = state.enabledSections["distribution"] === true;
  useEffect(() => {
    if (hasDistributionContent && !isDistributionEnabled) {
      setEnabled("distribution", true);
    }
  }, [hasDistributionContent, isDistributionEnabled, setEnabled]);

  return (
    <SectionExpansionProvider>
      <div className={BUILDER_GRID}>
        <ConfigurationTocSidebar
          activeTab={activeTab}
          sections={tocSections}
          activeKey={activeKey}
          onSectionClick={scrollToSection}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          customizationCount={customizationCount}
        />
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExpandCollapseToolbar />
          </div>
          <div
            ref={sectionsContainerRef}
            className="space-y-4"
            onFocusCapture={handleInteraction}
            onPointerDown={handleInteraction}
          >
            <GeneralSectionCard
              label={t("builder.sections.generalSettings")}
              sectionKey={GENERAL_SECTION_KEY}
              pathPrefix={`${INSTRUMENTATION_DEV_KEY}.${GENERAL_SUBKEY}`}
              defaultExpanded={true}
              emptyMessage={t("builder.general.empty")}
            >
              {generalNode?.children ?? []}
            </GeneralSectionCard>
            <InstrumentationBrowser
              instrumentations={instrumentationsState.data}
              loading={instrumentationsState.loading}
              error={instrumentationsState.error}
              search={search}
              statusFilter={statusFilter}
              onJumpToGeneral={scrollToSection}
            />
          </div>
        </div>
        <PreviewCard
          schema={schema}
          javaAgentVersion={javaAgentVersion}
          activePreviewKey={activePreviewKey}
        />
      </div>
    </SectionExpansionProvider>
  );
}

export function ConfigurationBuilderPage() {
  const { t } = useTranslation("java-agent");
  const schemaVersionsState = useConfigVersions();
  const latestSchemaVersion = useMemo(
    () =>
      schemaVersionsState.data?.versions.find((v) => v.is_latest)?.version ??
      schemaVersionsState.data?.versions[0]?.version ??
      "",
    [schemaVersionsState.data]
  );
  const [currentSchemaVersion, setCurrentSchemaVersion] = useState<string>("");
  const schemaVersion = currentSchemaVersion || latestSchemaVersion;
  const [activeTab, setActiveTab] = useState("sdk");

  const javaAgentVersionsState = useVersions();
  const javaAgentVersions = useMemo(
    () => javaAgentVersionsState.data?.versions ?? [],
    [javaAgentVersionsState.data]
  );
  const latestJavaAgentVersion = useMemo(
    () =>
      javaAgentVersions.find((v) => v.is_latest)?.version ?? javaAgentVersions[0]?.version ?? "",
    [javaAgentVersions]
  );
  const [currentJavaAgentVersion, setCurrentJavaAgentVersion] = useState<string>("");
  const javaAgentVersion = currentJavaAgentVersion || latestJavaAgentVersion;

  const schema = useConfigSchema(schemaVersion);
  const starter = useConfigStarter(schemaVersion);
  const root = (schema.data as GroupNode | null) ?? null;

  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold md:text-4xl">
                <span className="text-gradient-brand">{t("builder.title")}</span>
              </h1>
              <BetaBadge />
            </div>
            <p className="text-muted-foreground text-base">
              {t("builder.description")}{" "}
              <a
                href="https://opentelemetry.io/docs/zero-code/java/agent/declarative-configuration/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline"
              >
                {t("builder.links.declarativeConfig")}
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline"
              >
                {t("builder.links.reportIssue")}
              </a>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {schemaVersionsState.data && schemaVersion ? (
              <VersionSelector
                versions={schemaVersionsState.data.versions}
                currentVersion={schemaVersion}
                onVersionChange={setCurrentSchemaVersion}
                label={t("builder.sections.schema")}
                id="schema-version-select"
              />
            ) : null}
            {javaAgentVersions.length > 0 && javaAgentVersion ? (
              <VersionSelector
                versions={javaAgentVersions}
                currentVersion={javaAgentVersion}
                onVersionChange={setCurrentJavaAgentVersion}
                label={t("builder.sections.agent")}
                id="java-agent-version-select"
              />
            ) : null}
          </div>
        </div>
        {schemaVersionsState.loading ? (
          <Loader size="lg" label={t("builder.loading.versions")} className="mt-4" />
        ) : schemaVersionsState.error ? (
          <p className="mt-4 text-sm text-red-400">{t("builder.error.versions")}</p>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="sdk">
              {!schemaVersion || schema.loading || starter.loading || (!schema.error && !root) ? (
                <Loader
                  size={root ? "sm" : "lg"}
                  label={t("builder.loading.schema")}
                  className={root ? "mt-4" : undefined}
                />
              ) : schema.error ? (
                <p className="mt-4 text-sm text-red-400">{t("builder.error.schema")}</p>
              ) : starter.error ? (
                <p className="mt-4 text-sm text-red-400">{t("builder.error.template")}</p>
              ) : root ? (
                <SdkTabContent
                  schema={root}
                  starter={starter.data}
                  schemaVersion={schemaVersion}
                  javaAgentVersion={javaAgentVersion}
                  activeTab={activeTab}
                />
              ) : null}
            </TabsContent>
            <TabsContent value="instrumentation">
              {!schemaVersion || schema.loading || starter.loading || (!schema.error && !root) ? (
                <Loader
                  size={root ? "sm" : "lg"}
                  label={t("builder.loading.schema")}
                  className={root ? "mt-4" : undefined}
                />
              ) : schema.error ? (
                <p className="mt-4 text-sm text-red-400">{t("builder.error.schema")}</p>
              ) : starter.error ? (
                <p className="mt-4 text-sm text-red-400">{t("builder.error.template")}</p>
              ) : root ? (
                <InstrumentationTabContent
                  schema={root}
                  starter={starter.data}
                  schemaVersion={schemaVersion}
                  javaAgentVersion={javaAgentVersion}
                  activeTab={activeTab}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PageContainer>
  );
}
