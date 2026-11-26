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
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { renderWithInlineCode } from "@/lib/render-inline-code";
import type { ContribEntry } from "@/types/java-contrib";
import { ComponentTypeBadges, DistributionBadges, JavaVersionBadge } from "./contrib-badges";

interface ContribCardProps {
  entry: ContribEntry;
}

export function ContribCard({ entry }: ContribCardProps) {
  const { t } = useTranslation("java-agent");
  const { component, problems } = entry;

  return (
    <Link
      to={`/java-agent/contrib/${entry.id}`}
      className="group border-border bg-surface-card shadow-surface hover:border-secondary/40 hover:bg-card-secondary relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border p-6 transition-all duration-300 hover:shadow-[0_0_30px_hsl(var(--secondary-hsl)/0.12)]"
      aria-label={t("contrib.list.cardAriaLabel", { name: component.display_name })}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="group-hover:text-primary text-lg font-semibold transition-colors">
          {component.display_name}
        </h3>
        <StatusPill stability={component.status.stability} className="shrink-0" />
      </div>

      {component.artifact && (
        <code className="text-muted-foreground font-mono text-xs break-all">
          {component.artifact.artifact_id}
        </code>
      )}

      <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
        {/* Inline code only: Markdown links would nest <a> inside the card's link. */}
        {renderWithInlineCode(component.description)}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <ComponentTypeBadges types={component.component_types} />
        <DistributionBadges distributions={component.distributions} />
        <JavaVersionBadge version={component.min_java_version} />
        {import.meta.env.DEV && problems.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {t("contrib.problems.count", { count: problems.length })}
          </span>
        )}
      </div>
    </Link>
  );
}
