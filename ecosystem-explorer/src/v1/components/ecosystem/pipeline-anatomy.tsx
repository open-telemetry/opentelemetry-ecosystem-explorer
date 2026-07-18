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
 * PipelineAnatomy — array-driven horizontal stage strip. Each stage is a
 * deep-link into the list page via the `listFilters` URL contract.
 *
 * Collector usage: 5 stages (receiver, processor, exporter, connector,
 * extension) with the type-stripe color as the left edge. Java Agent uses
 * the same component with semantic categories (e.g. HTTP / DB / messaging)
 * — pass any stage IDs, the colors fall through `accentColor`.
 *
 * Layout: horizontal row with chevron separators on desktop; stacks
 * vertically on mobile.
 */

import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export interface PipelineStage {
  id: string;
  label: string;
  count: number | string;
  description?: string;
  href: string;
  /** Optional accent color (CSS color value). Defaults to the foreground token. */
  accentColor?: string;
}

export interface PipelineAnatomyProps {
  /** Pipeline title rendered above the stages. */
  title?: string;
  /** Optional lead sentence below the title. */
  lead?: string;
  stages: PipelineStage[];
  /** When true, hides the chevron between stages (use for category grids). */
  noFlow?: boolean;
}

export function PipelineAnatomy({ title, lead, stages, noFlow = false }: PipelineAnatomyProps) {
  const { t } = useTranslation("ecosystem");

  return (
    <section
      className="td-pipeline-anatomy"
      aria-label={title ?? t("pipelineAnatomy.defaultTitle")}
    >
      {title && <h2 className="td-pipeline-anatomy__title">{title}</h2>}
      {lead && <p className="td-pipeline-anatomy__lead">{lead}</p>}
      <div
        className={`td-pipeline-anatomy__stages ${
          noFlow ? "td-pipeline-anatomy__stages--grid" : ""
        }`}
      >
        {stages.map((stage, idx) => (
          <Fragment key={stage.id}>
            <Link
              to={stage.href}
              className="td-pipeline-stage"
              style={
                stage.accentColor
                  ? ({ ["--td-stage-accent" as never]: stage.accentColor } as React.CSSProperties)
                  : undefined
              }
              aria-label={t("pipelineAnatomy.stageAriaLabel", {
                label: stage.label,
                count: stage.count,
              })}
            >
              <span className="td-pipeline-stage__edge" aria-hidden />
              <div className="td-pipeline-stage__count">{stage.count}</div>
              <div className="td-pipeline-stage__label">{stage.label}</div>
              {stage.description && (
                <div className="td-pipeline-stage__description">{stage.description}</div>
              )}
            </Link>
            {!noFlow && idx < stages.length - 1 && (
              <ChevronRight
                className="td-pipeline-anatomy__chevron"
                aria-hidden
                focusable="false"
              />
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
