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
 * CoverBlock — always-dark hero shell that mirrors opentelemetry.io's
 * `.td-cover-block`. Reusable primitive: home (Phase 2) uses it with title +
 * lead + CTAs + a global-search slot via `children`; ecosystem-landing pages
 * (Phase 3) reuse it with a `<ReleaseCard />` in the `aside` slot.
 *
 * Surface: gradient between `--cover-block-bg-from-hsl` and
 * `--cover-block-bg-to-hsl`, decorated with two radial glows
 * (`--otel-orange-hsl` + `--otel-purple-hsl`) and a subtle grid drawn with
 * repeating linear-gradients on `::after`. Foreground uses
 * `--cover-block-fg-hsl`. Tokens are owned by `src/styles/tokens.css` /
 * `src/v1/styles/tokens.css`.
 *
 * Slot order: logo → eyebrow → h1 → lead → ctas → children. The `aside`
 * slot, when present, sits next to the content column on desktop (2-col)
 * and stacks below on mobile, toggled by the `.td-cover-block--split`
 * modifier.
 */

import type { ReactNode } from "react";

export interface CoverBlockProps {
  /** Optional brand mark rendered above the eyebrow/title (e.g. OTel logo SVG). */
  logo?: ReactNode;
  /** Small text rendered above the title (e.g. "Receiver · contrib"). */
  eyebrow?: ReactNode;
  /** Required heading content rendered inside the `<h1>`. */
  title: ReactNode;
  /** Supporting copy under the title. */
  lead?: ReactNode;
  /** Call-to-action row (typically one or more buttons / links). */
  ctas?: ReactNode;
  /**
   * Optional right-side slot. When present, the layout becomes 2-column on
   * desktop and stacks below the content on mobile. Used by ecosystem
   * landing for the `<ReleaseCard />`.
   */
  aside?: ReactNode;
  /** Children render below the CTAs (used by home page for global search). */
  children?: ReactNode;
  /**
   * Id applied to the `<h1>` and referenced by the section's
   * `aria-labelledby`. Override when a page renders multiple CoverBlocks.
   * Defaults to `"cover-block-title"`.
   */
  headingId?: string;
  /** Extra classes appended after the base + modifier classes. */
  className?: string;
}

export function CoverBlock({
  logo,
  eyebrow,
  title,
  lead,
  ctas,
  aside,
  children,
  headingId = "cover-block-title",
  className,
}: CoverBlockProps) {
  const classes = ["td-cover-block"];
  if (aside) classes.push("td-cover-block--split");
  if (className) classes.push(className);

  return (
    <section className={classes.join(" ")} aria-labelledby={headingId}>
      <div className="td-cover-block__inner">
        <div className="td-cover-block__content">
          {logo && <div className="td-cover-block__logo">{logo}</div>}
          {eyebrow && <div className="td-cover-block__eyebrow">{eyebrow}</div>}
          <h1 id={headingId} className="td-cover-block__title">
            {title}
          </h1>
          {lead && <p className="td-cover-block__lead">{lead}</p>}
          {ctas && <div className="td-cover-block__ctas">{ctas}</div>}
          {children}
        </div>
        {aside && <div className="td-cover-block__aside">{aside}</div>}
      </div>
    </section>
  );
}
