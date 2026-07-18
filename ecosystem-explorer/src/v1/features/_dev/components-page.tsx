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
 * Dev-only component showcase. Renders every v1 primitive in its canonical
 * states so the screenshot workflow can capture them in light + dark, the
 * pixel-diff script can flag regressions, and `axe-core` can scan a single
 * page that mounts the whole primitive surface.
 *
 * Reachable at `/_dev/components`. No nav link; URL-only.
 *
 * As each in-review Phase 1 PR lands (SubNav, TypeStripe + DetailCard slot,
 * FooterV1 + CncfCallout), add its primitive to the relevant section.
 */

import { GitCompare, LayoutGrid, Split } from "lucide-react";
import { useState } from "react";

import { GlowBadge } from "@/components/ui/glow-badge";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import { type Stability, StatusPill } from "@/components/ui/status-pill";
import { ReleaseCard } from "@/v1/components/ecosystem/release-card";
import {
  ActiveFilterChips,
  DensityToggle,
  EmptyState,
  FacetDrawerToggle,
  Pagination,
  SortDropdown,
} from "@/v1/components/list/controls";
import { DEFAULT_FILTERS, activeFilterCount, type ListFilters } from "@/v1/lib/list-filters";
import { type PipelineStage, PipelineAnatomy } from "@/v1/components/ecosystem/pipeline-anatomy";
import { QuickEntryRow } from "@/v1/components/ecosystem/quick-entry-row";
import { FacetPanel } from "@/v1/components/list/facet-panel";
import { CheckboxFacet, SearchFacet, SelectFacet } from "@/v1/components/list/facets";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { EcosystemsGrid } from "@/v1/components/home/ecosystems-grid";
import { GlobalSearch } from "@/v1/components/home/global-search";
import { RecentActivityRail } from "@/v1/components/home/recent-activity-rail";
import { SignalsRow } from "@/v1/components/home/signals-row";
import { StatsBand } from "@/v1/components/home/stats-band";

const STABILITIES: Stability[] = [
  "development",
  "alpha",
  "beta",
  "stable",
  "deprecated",
  "unmaintained",
];

// Collector pipeline: five stages with type-stripe accent colors and
// deep-links into the list page via the `?type=` URL contract.
const COLLECTOR_STAGES: PipelineStage[] = [
  {
    id: "receiver",
    label: "Receivers",
    count: 98,
    description: "Ingest data",
    href: "/collector/components?type=receiver",
    accentColor: "hsl(200 85% 45%)",
  },
  {
    id: "processor",
    label: "Processors",
    count: 28,
    description: "Transform data",
    href: "/collector/components?type=processor",
    accentColor: "hsl(265 70% 55%)",
  },
  {
    id: "exporter",
    label: "Exporters",
    count: 64,
    description: "Send data onward",
    href: "/collector/components?type=exporter",
    accentColor: "hsl(150 65% 40%)",
  },
  {
    id: "connector",
    label: "Connectors",
    count: 12,
    description: "Bridge pipelines",
    href: "/collector/components?type=connector",
    accentColor: "hsl(35 90% 50%)",
  },
  {
    id: "extension",
    label: "Extensions",
    count: 21,
    description: "Add capabilities",
    href: "/collector/components?type=extension",
    accentColor: "hsl(0 75% 55%)",
  },
];

// Category grid: stages without chevrons (noFlow) — semantic groupings
// rather than an ordered pipeline.
const CATEGORY_STAGES: PipelineStage[] = [
  {
    id: "http",
    label: "HTTP",
    count: 14,
    description: "Web frameworks & clients",
    href: "/java-agent/components?category=http",
  },
  {
    id: "database",
    label: "Databases",
    count: 22,
    description: "JDBC & NoSQL drivers",
    href: "/java-agent/components?category=database",
  },
  {
    id: "messaging",
    label: "Messaging",
    count: 9,
    description: "Queues & streams",
    href: "/java-agent/components?category=messaging",
  },
  {
    id: "rpc",
    label: "RPC",
    count: 6,
    description: "gRPC & service calls",
    href: "/java-agent/components?category=rpc",
  },
];

const GLOW_VARIANTS = [
  "accent",
  "secondary",
  "success",
  "info",
  "warning",
  "error",
  "muted",
] as const;

function Section({
  id,
  title,
  children,
  bare = false,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  /**
   * When true, omits the inline flex-wrap wrapper used for pill primitives.
   * Use for full-width primitives (e.g. CoverBlock) that bring their own
   * layout and shouldn't be constrained by the showcase frame.
   */
  bare?: boolean;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <h2 id={`${id}-heading`} className="text-foreground text-lg font-semibold">
        {title}
      </h2>
      {bare ? (
        children
      ) : (
        <div className="bg-card/40 border-border/40 flex flex-wrap items-center gap-3 rounded-md border p-4">
          {children}
        </div>
      )}
    </section>
  );
}

// Interactive list-controls demo: the controls are stateless dispatchers on
// the real list page (the URL owns the state), so the showcase supplies a
// local `ListFilters` object for them to act on.
function ListControlsShowcase() {
  const [filters, setFilters] = useState<ListFilters>({
    ...DEFAULT_FILTERS,
    types: ["receiver", "processor"],
    signals: ["traces"],
    q: "kafka",
    page: 2,
  });
  const onChange = (next: Partial<ListFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  return (
    <div className="space-y-4">
      {/* Mobile-only by design: hidden at >=992px, where the facet rail is visible. */}
      <FacetDrawerToggle filters={filters} onClick={() => {}} />
      <ActiveFilterChips filters={filters} onChange={onChange} />
      <div className="flex flex-wrap items-center gap-3">
        <DensityToggle value={filters.density} onChange={(density) => onChange({ density })} />
        <SortDropdown value={filters.sort} onChange={(sort) => onChange({ sort })} />
      </div>
      <Pagination page={filters.page} totalPages={5} onChange={(page) => onChange({ page })} />
      <EmptyState
        hasActiveFilters={activeFilterCount(filters) > 0}
        onClearAll={() => setFilters(DEFAULT_FILTERS)}
      />
    </div>
  );
}

// Showcase CTAs are identical across the two CoverBlock variants below
// (dead-click stubs for visual exercise only). Hoisted so future styling
// or accessibility tweaks touch one place.
const showcaseCtas = (
  <>
    <button type="button" className="td-btn td-btn--primary">
      Primary CTA
    </button>
    <button type="button" className="td-btn td-btn--outline-light">
      Secondary CTA
    </button>
  </>
);

// Facet primitives are controlled, so the showcase holds their state locally
// to keep them interactive under the screenshot/a11y capture.
function FacetShowcase() {
  const [types, setTypes] = useState<string[]>(["receiver", "exporter"]);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState<string | null>(null);

  return (
    <div className="grid max-w-xs gap-6">
      <CheckboxFacet
        title="Component type"
        selected={types}
        onChange={setTypes}
        options={[
          { value: "receiver", label: "Receiver", count: 98, swatch: TYPE_STRIPE_COLORS.receiver },
          {
            value: "processor",
            label: "Processor",
            count: 28,
            swatch: TYPE_STRIPE_COLORS.processor,
          },
          { value: "exporter", label: "Exporter", count: 64, swatch: TYPE_STRIPE_COLORS.exporter },
          {
            value: "connector",
            label: "Connector",
            count: 12,
            swatch: TYPE_STRIPE_COLORS.connector,
          },
          {
            value: "extension",
            label: "Extension",
            count: 21,
            swatch: TYPE_STRIPE_COLORS.extension,
          },
        ]}
      />
      <SearchFacet
        title="Search"
        placeholder="Search components…"
        value={query}
        onChange={setQuery}
      />
      <SelectFacet
        title="Version"
        value={version}
        onChange={setVersion}
        emptyLabel="Latest"
        options={[
          { value: "v0.150.0", label: "v0.150.0" },
          { value: "v0.149.0", label: "v0.149.0" },
          { value: "v0.148.0", label: "v0.148.0" },
        ]}
      />
    </div>
  );
}

// FacetPanel is controlled by the list page's URL state in production; the
// showcase holds a local ListFilters object and merges partial updates the
// same way the page will.
function FacetPanelShowcase() {
  const [filters, setFilters] = useState<ListFilters>({
    ...DEFAULT_FILTERS,
    types: ["receiver"],
    signals: ["traces"],
  });

  return (
    <div className="max-w-xs">
      <FacetPanel
        filters={filters}
        onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
        versions={["v0.150.0", "v0.149.0", "v0.148.0"]}
        counts={{
          types: { receiver: 98, processor: 28, exporter: 64, connector: 12, extension: 21 },
          signals: { traces: 112, metrics: 96, logs: 74, baggage: 8 },
          distributions: { core: 41, contrib: 182 },
        }}
      />
    </div>
  );
}

export function DevComponentsPage() {
  // Wrapper is a <section>, not <main>: V1App.tsx and LegacyApp.tsx already
  // render a <main> around every route, and nested landmarks would fail axe.
  return (
    <section
      data-testid="dev-components-page"
      aria-labelledby="dev-components-heading"
      className="bg-background mx-auto max-w-5xl space-y-8 px-6 py-12"
    >
      <header className="space-y-2">
        <h1 id="dev-components-heading" className="text-foreground text-2xl font-semibold">
          Component showcase
        </h1>
        <p className="text-muted-foreground text-sm">
          Dev-only surface that renders every v1 primitive in its canonical states. Captured by the
          screenshot workflow for visual regression and a11y baselines.
        </p>
      </header>

      <Section id="status-pill" title="StatusPill (six stability levels)">
        {STABILITIES.map((s) => (
          <StatusPill key={s} stability={s} />
        ))}
      </Section>

      <Section id="glow-badge" title="GlowBadge (seven variants, with glow)">
        {GLOW_VARIANTS.map((v) => (
          <GlowBadge key={v} variant={v} withGlow>
            {v}
          </GlowBadge>
        ))}
      </Section>

      <Section id="glow-badge-no-glow" title="GlowBadge (no glow)">
        {GLOW_VARIANTS.map((v) => (
          <GlowBadge key={v} variant={v}>
            {v}
          </GlowBadge>
        ))}
      </Section>

      <Section id="cover-block-title-only" title="CoverBlock (title-only variant)" bare>
        <CoverBlock
          headingId="cover-block-showcase-title-only"
          title={
            <>
              Showcase <span className="td-cover-block__title-accent">Cover Block</span>
            </>
          }
          lead="Title-only variant — used by the home page hero."
          ctas={showcaseCtas}
        />
      </Section>

      <Section id="cover-block-with-aside" title="CoverBlock (title + aside, split layout)" bare>
        <CoverBlock
          headingId="cover-block-showcase-with-aside"
          title={
            <>
              Showcase <span className="td-cover-block__title-accent">Cover Block</span>
            </>
          }
          lead="Title + aside variant — exercises the `td-cover-block--split` modifier."
          ctas={showcaseCtas}
          aside={
            <div className="td-cover-block__release-card-placeholder">
              Aside slot (Phase 3 ecosystem-landing renders &lt;ReleaseCard /&gt; here)
            </div>
          }
        />
      </Section>

      <Section id="stats-band" title="StatsBand (OTel-purple counter strip)" bare>
        <StatsBand headingId="stats-band-showcase-title" />
      </Section>

      <Section
        id="ecosystems-grid"
        title="EcosystemsGrid (two active + four coming-soon cards)"
        bare
      >
        <EcosystemsGrid headingId="ecosystems-grid-showcase-title" />
      </Section>

      <Section id="signals-row" title="SignalsRow (Traces / Metrics / Logs / Baggage)" bare>
        <SignalsRow headingId="signals-row-showcase-title" />
      </Section>

      <Section
        id="global-search"
        title="GlobalSearch (cover-block search input with ⌘K shortcut)"
        bare
      >
        {/* Wrapped in a dark surface so the glass-effect input reads correctly;
            on the real home page GlobalSearch lives inside <CoverBlock>. */}
        <div
          style={{
            background: "hsl(var(--cover-block-bg-from-hsl))",
            padding: "2rem 1.5rem",
          }}
        >
          <GlobalSearch />
        </div>
      </Section>

      <Section
        id="recent-activity-rail"
        title="RecentActivityRail (consumes /data/activity/feed.json)"
        bare
      >
        <RecentActivityRail />
      </Section>

      <Section id="release-card" title="ReleaseCard (full card + empty state)" bare>
        {/* Wrapped in a dark surface so the glass-effect card reads correctly;
            on the real ecosystem-landing page ReleaseCard lives inside the
            <CoverBlock> aside slot. */}
        <div
          style={{
            background: "hsl(var(--cover-block-bg-from-hsl))",
            display: "flex",
            flexWrap: "wrap",
            gap: "1.5rem",
            padding: "2rem 1.5rem",
          }}
        >
          <ReleaseCard
            version="v0.150.0"
            releaseDate="May 2026"
            deltas={{ added: 4, changed: 12, deprecated: 2 }}
            hrefChangelog="https://opentelemetry.io/"
          />
          <ReleaseCard version={null} />
        </div>
      </Section>

      <Section
        id="pipeline-anatomy-flow"
        title="PipelineAnatomy (Collector pipeline — five stages with chevron flow)"
        bare
      >
        <PipelineAnatomy
          title="Pipeline anatomy"
          lead="The flow of telemetry through a Collector — receivers ingest, processors transform, exporters emit."
          stages={COLLECTOR_STAGES}
        />
      </Section>

      <Section
        id="pipeline-anatomy-grid"
        title="PipelineAnatomy (category grid — noFlow, no chevrons)"
        bare
      >
        <PipelineAnatomy
          title="Instrumentation categories"
          lead="Semantic groupings rather than an ordered pipeline."
          stages={CATEGORY_STAGES}
          noFlow
        />
      </Section>

      <Section
        id="quick-entry-row"
        title="QuickEntryRow (ecosystem-landing shortcut cards, internal + external)"
        bare
      >
        <QuickEntryRow
          items={[
            {
              id: "most-used",
              title: "Most-used components",
              description: "Jump to the components the ecosystem leans on most.",
              href: "/collector/components?sort=updated",
              icon: <LayoutGrid aria-hidden focusable="false" />,
            },
            {
              id: "diff-versions",
              title: "Diff across versions",
              description: "Compare what changed between two registry snapshots.",
              href: "/collector/components?compare=true",
              icon: <GitCompare aria-hidden focusable="false" />,
            },
            {
              id: "core-contrib",
              title: "Core vs. Contrib",
              description: "Understand the split between core and contrib distributions.",
              href: "https://opentelemetry.io/",
              external: true,
              icon: <Split aria-hidden focusable="false" />,
            },
          ]}
        />
      </Section>

      <Section
        id="facets"
        title="Facets (CheckboxFacet with counts + swatches, SearchFacet, SelectFacet)"
        bare
      >
        <FacetShowcase />
      </Section>

      <Section
        id="facet-panel"
        title="FacetPanel (composed facet rail with counts + version select)"
        bare
      >
        <FacetPanelShowcase />
      </Section>

      <Section
        id="list-controls"
        title="List controls (chips, density toggle, sort, pagination, empty state)"
        bare
      >
        <ListControlsShowcase />
      </Section>

      <Section
        id="stability-badge"
        title="StabilityBadge (legacy, pending migration to StatusPill)"
      >
        <StabilityBadge stability="development" />
      </Section>
    </section>
  );
}
