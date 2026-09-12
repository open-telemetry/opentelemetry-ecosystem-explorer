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

export function AttributeDiffList({ changes }: AttributeDiffListProps) {
  const { t } = useTranslation("collector");
  const hasChanges =
    changes.added.length > 0 || changes.removed.length > 0 || changes.changed.length > 0;

  if (!hasChanges) {
    return null;
  }

  return (
    <div className="border-border/30 overflow-hidden rounded-lg border">
      <table aria-label={t("diffAttributeTable.ariaLabel")} className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/30">
            <th
              scope="col"
              className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
            >
              {t("diffAttributeTable.columns.status")}
            </th>
            <th
              scope="col"
              className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
            >
              {t("diffAttributeTable.columns.key")}
            </th>
            <th
              scope="col"
              className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
            >
              {t("diffAttributeTable.columns.type")}
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.added.map((attr, index) => (
            <tr key={`added-${attr.key}`} className={index % 2 === 1 ? "bg-muted/20" : ""}>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    {t("diffAttributeTable.status.added")}
                  </span>
                </div>
              </td>
              <td className="p-4 font-mono text-sm md:text-[12px]">
                {attr.definition?.name_override ?? attr.key}
              </td>
              <td className="p-4">
                <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold uppercase">
                  {attr.definition?.type ?? "—"}
                </span>
              </td>
            </tr>
          ))}

          {changes.removed.map((attr, index) => (
            <tr
              key={`removed-${attr.key}`}
              className={(index + changes.added.length) % 2 === 1 ? "bg-muted/20" : ""}
            >
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Minus className="h-3 w-3 text-red-600 dark:text-red-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">
                    {t("diffAttributeTable.status.removed")}
                  </span>
                </div>
              </td>
              <td className="p-4 font-mono text-sm line-through opacity-60 md:text-[12px]">
                {attr.definition?.name_override ?? attr.key}
              </td>
              <td className="p-4">
                <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold uppercase opacity-60">
                  {attr.definition?.type ?? "—"}
                </span>
              </td>
            </tr>
          ))}

          {changes.changed.map((change, index) => (
            <tr
              key={`changed-${change.key}`}
              className={
                (index + changes.added.length + changes.removed.length) % 2 === 1
                  ? "bg-muted/20"
                  : ""
              }
            >
              <td className="p-4">
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                  {t("diffAttributeTable.status.modified")}
                </span>
              </td>
              <td className="p-4 font-mono text-sm md:text-[12px]">
                {change.after?.name_override ?? change.before?.name_override ?? change.key}
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold uppercase line-through opacity-60">
                    {change.before?.type ?? "—"}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold uppercase">
                    {change.after?.type ?? "—"}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
