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

import { GlowBadge } from "@/components/ui/glow-badge";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { type Stability, StatusPill } from "@/components/ui/status-pill";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { StatsBand } from "@/v1/components/home/stats-band";

const STABILITIES: Stability[] = [
  "development",
  "alpha",
  "beta",
  "stable",
  "deprecated",
  "unmaintained",
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
        id="stability-badge"
        title="StabilityBadge (legacy, pending migration to StatusPill)"
      >
        <StabilityBadge stability="development" />
      </Section>
    </section>
  );
}
