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
import { Plus, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CollectorAttributeChanges } from "@/types/collector";

interface AttributeDiffListProps {
  changes: CollectorAttributeChanges;
}

/**
 * Renders added/removed attribute keys for a metric. Collector metric
 * attributes are plain key references into the component's `attributes`
 * map (`string[]`), not typed inline values like Java Agent's `Attribute`,
 * so there is no "type changed" row here - a key is either present or not.
 */
export function AttributeDiffList({ changes }: AttributeDiffListProps) {
  const { t } = useTranslation("collector");
  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  if (!hasChanges) {
    return null;
  }

  return (
    <ul
      aria-label={t("telemetryComparison.diffAttributeList.ariaLabel")}
      className="border-border/30 divide-border/20 divide-y overflow-hidden rounded-lg border"
    >
      {changes.added.map((key) => (
        <li key={`added-${key}`} className="flex items-center gap-2 p-3">
          <Plus className="h-3 w-3 flex-shrink-0 text-green-400" aria-hidden="true" />
          <span className="text-xs font-medium text-green-400">
            {t("telemetryComparison.diffAttributeList.added")}
          </span>
          <code className="font-mono text-sm">{key}</code>
        </li>
      ))}
      {changes.removed.map((key) => (
        <li key={`removed-${key}`} className="flex items-center gap-2 p-3">
          <Minus className="h-3 w-3 flex-shrink-0 text-red-400" aria-hidden="true" />
          <span className="text-xs font-medium text-red-400">
            {t("telemetryComparison.diffAttributeList.removed")}
          </span>
          <code className="font-mono text-sm line-through opacity-60">{key}</code>
        </li>
      ))}
    </ul>
  );
}
