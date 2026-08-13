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

/*
 * CollectorDetailPageV1 — Phase 5 detail page, three-pane layout:
 *   ┌──────────┬──────────────────┬───────────┐
 *   │ Sibling  │  Header / tabs   │  Version  │
 *   │ navigator│  (configuration, │  timeline │
 *   │ + on-page│   README,        │  + diff   │
 *   │ anchors  │   attributes,    │  + compat │
 *   │          │   examples)      │           │
 *   └──────────┴──────────────────┴───────────┘
 *
 * The grid collapses to two columns below 1280px (the right rail spanning the
 * full width beneath) and to a single column below 992px.
 *
 * Data: reuses `useCollectorComponent` + `useCollectorComponents` from the
 * existing hooks so the v1 view is a re-skin, not a reimplementation. The
 * configuration, README, and examples tabs are not yet backed by registry
 * data — they render their empty states with a link out to the source.
 */

import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import { CollectorReadmeTab } from "@/features/collector/components/collector-readme-tab";
import {
  useCollectorComponent,
  useCollectorComponents,
  useCollectorDeprecations,
  useCollectorVersions,
  useComponentVersions,
} from "@/hooks/use-collector-data";
import type { CollectorComponent } from "@/types/collector";
import { SubNav } from "@/v1/components/layout/sub-nav";
import {
  CompatibilityCard,
  DiffSelector,
  VersionTimeline,
} from "@/v1/components/detail/version-timeline";
import { DetailHeader } from "@/v1/components/detail/detail-header";
import {
  type OnPageAnchor,
  OnPageAnchors,
  SiblingNavigator,
  type SiblingItem,
} from "@/v1/components/detail/sibling-navigator";
import { PipelinePlacement } from "@/v1/components/detail/pipeline-placement";
import {
  type AttributeRow,
  AttributesTab,
  ConfigurationTab,
  DetailTabs,
  type DetailTabId,
  ExamplesTab,
  ReadmeTab,
} from "@/v1/components/detail/tabs";
import type { StabilityFacet } from "@/v1/lib/list-filters";

function topStability(c: CollectorComponent): string {
  const stab = c.status?.stability;
  if (!stab) return "development";
  const rank: Record<string, number> = {
    stable: 5,
    beta: 4,
    alpha: 3,
    development: 2,
    deprecated: 1,
    unmaintained: 0,
  };
  let best = "development";
  let bestRank = -1;
  for (const key of Object.keys(stab) as StabilityFacet[]) {
    if ((rank[key] ?? -1) > bestRank && (stab[key]?.length ?? 0) > 0) {
      best = key;
      bestRank = rank[key] ?? -1;
    }
  }
  return best;
}

function emittedSignals(c: CollectorComponent): string[] {
  const stab = c.status?.stability;
  if (!stab) return [];
  const all = Object.values(stab).flat();
  return Array.from(new Set(all));
}

/*
 * Flatten the component's emitted telemetry into attribute-table rows:
 * metric names first, then component attributes, then resource attributes.
 * `name_override` wins over the map key so the row shows the exported name.
 */
function attributeRows(c: CollectorComponent): AttributeRow[] {
  const rows: AttributeRow[] = [];
  for (const name of Object.keys(c.metrics ?? {}).sort()) {
    rows.push({ name, kind: "metric", description: c.metrics?.[name]?.description });
  }
  for (const [key, def] of Object.entries(c.attributes ?? {})) {
    rows.push({ name: def.name_override ?? key, kind: "attribute", description: def.description });
  }
  for (const [key, def] of Object.entries(c.resource_attributes ?? {})) {
    rows.push({ name: def.name_override ?? key, kind: "resource", description: def.description });
  }
  return rows;
}

function sourceHref(c: CollectorComponent, version?: string): string | null {
  if (!c.repository) return null;
  const ref = version ? `v${version}` : "main";
  return `https://github.com/open-telemetry/${c.repository}/tree/${ref}/${c.type}/${c.name}`;
}

// Prefer the human-friendly display name, falling back to the slug.
function displayLabel(c: { display_name?: string | null; name: string }): string {
  return c.display_name?.trim() || c.name;
}

export function CollectorDetailPageV1() {
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("collector");
  const { distribution, name } = useParams<{ distribution: string; name: string }>();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DetailTabId>("configuration");

  // Single writer for the tab deep-link hash: both the tablist and the on-page
  // anchors change tabs through here so the URL always mirrors the active tab.
  // DetailTabs still reads the hash on mount/hashchange for direct-link loads.
  function selectTab(next: DetailTabId) {
    setActiveTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  const versionsQ = useCollectorVersions();
  // Explicit `?version=` wins; otherwise fall back to the latest release so a
  // bare `/collector/components/:distribution/:name` link (how the list page
  // links) resolves instead of showing "not found".
  const rawVersion = searchParams.get("version");
  const deprecatedView = rawVersion === "deprecated";
  const deprecationsQuery = useCollectorDeprecations(deprecatedView);
  const deprecatedEntry = deprecationsQuery.data?.components.find(
    (entry) => entry.distribution === distribution && entry.name === name
  );
  const latestVersion = versionsQ.data?.versions.find((v) => v.is_latest)?.version ?? "";
  const version = deprecatedView
    ? (deprecatedEntry?.last_version ?? "")
    : rawVersion || latestVersion;
  const versionLoading = deprecatedView ? deprecationsQuery.loading : !version && !versionsQ.error;

  const componentQ = useCollectorComponent(distribution ?? "", name ?? "", version);
  const componentsQ = useCollectorComponents(deprecatedView ? "" : version);
  const componentVersionsQ = useComponentVersions(distribution ?? "", name ?? "");

  const component = componentQ.data;
  const loading = componentQ.loading;
  const error = componentQ.error || (deprecatedView ? deprecationsQuery.error : null);

  // A component missing from the requested release is an expected state, not a
  // failure, so it gets its own designed answer below. Deciding which of the
  // two a failed load is needs the release list, so wait for it rather than
  // flashing the generic message and swapping it a moment later.
  const releasedVersions = componentVersionsQ.data;
  const notReleasedHere = Boolean(
    version && releasedVersions && !releasedVersions.includes(version)
  );

  if (loading || versionLoading || (error && componentVersionsQ.loading)) {
    return (
      <div className="td-detail">
        <div className="td-detail__loading" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden focusable="false" />
          <span>{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (notReleasedHere || error || (!version && versionsQ.error) || !component) {
    // The registry simply has no entry here: name the release, and offer the
    // newest one that does carry the component so the user isn't dead-ended.
    const suggestion = notReleasedHere ? releasedVersions?.[0] : undefined;
    return (
      <div className="td-detail">
        <SubNav
          crumbs={[
            { label: t("breadcrumbs.explorer"), href: "/" },
            { label: tc("header.title"), href: "/collector" },
            { label: t("breadcrumbs.components"), href: "/collector/components" },
            { label: name ?? t("breadcrumbs.components") },
          ]}
        />
        <div className="td-box td-box--light">
          <div className="td-box__container">
            <div className="td-empty" role="alert">
              <AlertCircle className="h-6 w-6" aria-hidden focusable="false" />
              <p className="td-empty__title">
                {notReleasedHere ? t("notReleased.title") : t("notFound.title")}
              </p>
              <p className="td-empty__lead">
                {notReleasedHere
                  ? t("notReleased.lead", { component: name, version })
                  : t("notFound.lead")}
              </p>
              {suggestion && (
                <Link
                  className="td-btn td-btn--outline-dark"
                  to={`/collector/components/${distribution}/${name}?version=${encodeURIComponent(
                    suggestion
                  )}`}
                >
                  {t("notReleased.cta", { version: suggestion })}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const componentType = component.type as CollectorComponentType;
  const displayName = displayLabel(component);
  const stability = deprecatedView ? "deprecated" : topStability(component);
  const signals = emittedSignals(component);
  const href = sourceHref(component, deprecatedView ? version : undefined);

  // Sibling links preserve the explicit `?version=` when present, but never
  // synthesize one for the latest view (so latest-view links stay bare).
  const siblingSuffix = rawVersion ? `?version=${encodeURIComponent(rawVersion)}` : "";
  const siblingComponents = deprecatedView
    ? (deprecationsQuery.data?.components ?? [])
    : (componentsQ.data ?? []);
  const siblings: SiblingItem[] = siblingComponents.flatMap((c) =>
    c.type === component.type
      ? [
          {
            id: c.id,
            name: c.name,
            displayName: displayLabel(c),
            href: `/collector/components/${c.distribution}/${c.name}${siblingSuffix}`,
          },
        ]
      : []
  );

  const anchors: OnPageAnchor[] = [
    { id: "placement", label: t("anchors.placement") },
    { id: "configuration", label: t("anchors.configuration"), tab: "configuration" },
    { id: "readme", label: t("anchors.readme"), tab: "readme" },
    { id: "attributes", label: t("anchors.attributes"), tab: "attributes" },
    { id: "examples", label: t("anchors.examples"), tab: "examples" },
  ];

  // Right-rail data. Only the releases this component actually appears in: the
  // global versions index covers every Collector release, so offering it whole
  // links to versions whose manifest has no entry for the component and the
  // page fails to load. While presence is in flight — or if it errored — the
  // timeline falls back to the version being viewed, the one release known to
  // exist, rather than making dead links clickable for the duration.
  //
  // `is_latest` is the only per-version summary the registry exposes today;
  // per-version change one-liners are deferred. Timeline and diff links target
  // the current component's canonical distribution/name.
  const availableVersions = componentVersionsQ.data ?? [version];
  const versionEntries = availableVersions.map((v) => ({
    version: v,
    summary: v === latestVersion ? t("timeline.latest") : undefined,
  }));
  const detailBase = `/collector/components/${component.distribution}/${component.name}`;

  return (
    <div className="td-detail">
      <SubNav
        crumbs={[
          { label: t("breadcrumbs.explorer"), href: "/" },
          { label: tc("header.title"), href: "/collector" },
          { label: t("breadcrumbs.components"), href: "/collector/components" },
          { label: displayName },
        ]}
      />

      <div className="td-detail__layout td-box td-box--light">
        <aside className="td-detail__rail-left" aria-label={t("railLabel")}>
          <SiblingNavigator
            title={tc(`detail.typeLabels.${componentType}`)}
            items={siblings}
            activeId={component.id}
          />
          <OnPageAnchors anchors={anchors} activeId={activeTab} onSelectTab={selectTab} />
        </aside>

        <main className="td-detail__main">
          {deprecatedEntry && (
            <div className="td-detail-notice" role="note">
              <AlertTriangle className="td-detail-notice__icon" aria-hidden />
              <div className="td-detail-notice__body">
                <p className="td-detail-notice__title">{tc("deprecated.title")}</p>
                <p className="td-detail-notice__description">
                  {tc("deprecated.lead", {
                    lastVersion: deprecatedEntry.last_version,
                    removedVersion: deprecatedEntry.deprecated_in_version,
                  })}
                </p>
              </div>
            </div>
          )}
          <DetailHeader
            type={componentType}
            distribution={component.distribution}
            displayName={displayName}
            slug={component.name}
            description={component.description}
            stability={stability}
            version={version}
            signals={signals}
            hrefRepository={href}
            hrefDocs={null}
          />

          <section id="placement">
            <PipelinePlacement activeType={componentType} activeName={displayName} />
          </section>

          <section id="content">
            <DetailTabs active={activeTab} onChange={selectTab}>
              {activeTab === "configuration" && <ConfigurationTab rows={null} hrefSource={href} />}
              {activeTab === "readme" &&
                (deprecatedView && component.markdown_hash ? (
                  <CollectorReadmeTab
                    name={component.name}
                    markdownHash={component.markdown_hash}
                  />
                ) : (
                  <ReadmeTab hrefSource={href} />
                ))}
              {activeTab === "attributes" && <AttributesTab rows={attributeRows(component)} />}
              {activeTab === "examples" && <ExamplesTab snippets={[]} hrefExamples={href} />}
            </DetailTabs>
          </section>
        </main>

        <aside className="td-detail__rail-right" aria-label={t("rightRailLabel")}>
          <VersionTimeline
            versions={versionEntries}
            currentVersion={version}
            buildHref={(v) => `${detailBase}?version=${encodeURIComponent(v)}`}
          />
          <DiffSelector
            // The selector seeds its from/to state on first render, and the
            // version list resolves asynchronously. Keying on the list remounts
            // it once presence lands, so the dropdowns can't keep the values
            // derived from the single-version fallback.
            key={availableVersions.join(",")}
            versions={availableVersions}
            defaultTo={version}
            buildHref={(from, to) =>
              `${detailBase}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            }
          />
          <CompatibilityCard distributions={component.status?.distributions} />
        </aside>
      </div>
    </div>
  );
}
