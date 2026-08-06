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
 * PipelinePlacement — "Where this fits" mini-diagram showing the current
 * component in a typical Collector pipeline, with sibling stages linkable
 * to their canonical components.
 *
 * For v1 the placement is rendered from a hard-coded default pipeline per
 * component type (e.g. receivers always sit at the start). A future
 * iteration could pull a "recommended" placement from the registry.
 */

import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import { filtersToHref } from "@/v1/lib/list-filters";

const DEFAULT_PIPELINE: CollectorComponentType[] = ["receiver", "processor", "exporter"];

export interface PipelinePlacementProps {
  activeType: CollectorComponentType;
  activeName: string;
}

function pipelineFor(activeType: CollectorComponentType): CollectorComponentType[] {
  if (activeType === "connector") return ["receiver", "connector", "exporter"];
  if (activeType === "extension") return ["extension"];
  if (DEFAULT_PIPELINE.includes(activeType)) return DEFAULT_PIPELINE;
  return [activeType];
}

export function PipelinePlacement({ activeType, activeName }: PipelinePlacementProps) {
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("collector");
  const stages = pipelineFor(activeType);
  return (
    <section className="td-placement" aria-labelledby="placement-title">
      <h2 id="placement-title" className="td-placement__title">
        {t("placement.title")}
      </h2>
      <p className="td-placement__lead">{t("placement.lead")}</p>
      <div className="td-placement__strip">
        {stages.map((stage, idx) => {
          const isActive = stage === activeType;
          const stageLabel = tc(`detail.typeLabels.${stage}`);
          const stageStyle = {
            ["--td-stage-accent" as never]: TYPE_STRIPE_COLORS[stage],
          } as React.CSSProperties;
          return (
            <Fragment key={stage}>
              {isActive ? (
                <div className="td-placement__stage td-placement__stage--active" style={stageStyle}>
                  <span className="td-placement__stage-label">{stageLabel}</span>
                  <span className="td-placement__stage-active">{activeName}</span>
                </div>
              ) : (
                <Link
                  to={filtersToHref("/collector/components", { types: [stage] })}
                  className="td-placement__stage"
                  style={stageStyle}
                >
                  <span className="td-placement__stage-label">{stageLabel}</span>
                </Link>
              )}
              {idx < stages.length - 1 && (
                <ChevronRight className="td-placement__chevron" aria-hidden focusable="false" />
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
