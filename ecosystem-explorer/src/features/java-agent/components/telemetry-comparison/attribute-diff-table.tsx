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
import type { AttributeChanges } from "@/types/javaagent";

interface AttributeDiffTableProps {
  changes: AttributeChanges;
}

export function AttributeDiffTable({ changes }: AttributeDiffTableProps) {
  const hasChanges =
    changes.added.length > 0 || changes.removed.length > 0 || changes.changed.length > 0;

  if (!hasChanges) {
    return null;
  }

  return (
    <div className="border-border/30 overflow-hidden rounded-lg border">
      <table aria-label="Attribute changes" className="w-full border-collapse">
        <thead>
          <tr className="bg-white/5">
            <th
              scope="col"
              className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
            >
              Status
            </th>
            <th
              scope="col"
              className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
            >
              Key
            </th>
            <th
              scope="col"
              className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
            >
              Type
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Added attributes */}
          {changes.added.map((attr, index) => (
            <tr key={`added-${attr.name}`} className={index % 2 === 1 ? "bg-muted/40" : ""}>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3 text-green-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-green-400">Added</span>
                </div>
              </td>
              <td className="p-4 font-mono text-sm md:text-[12px]">{attr.name}</td>
              <td className="p-4">
                <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold">
                  {attr.type}
                </span>
              </td>
            </tr>
          ))}

          {/* Removed attributes */}
          {changes.removed.map((attr, index) => (
            <tr
              key={`removed-${attr.name}`}
              className={(index + changes.added.length) % 2 === 1 ? "bg-muted/40" : ""}
            >
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Minus className="h-3 w-3 text-red-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-red-400">Removed</span>
                </div>
              </td>
              <td className="p-4 font-mono text-sm line-through opacity-60 md:text-[12px]">
                {attr.name}
              </td>
              <td className="p-4">
                <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold opacity-60">
                  {attr.type}
                </span>
              </td>
            </tr>
          ))}

          {/* Changed attributes (type changes) */}
          {changes.changed.map((change, index) => (
            <tr
              key={`changed-${change.name}`}
              className={
                (index + changes.added.length + changes.removed.length) % 2 === 1
                  ? "bg-muted/40"
                  : ""
              }
            >
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-amber-400">Modified</span>
                </div>
              </td>
              <td className="p-4 font-mono text-sm md:text-[12px]">{change.name}</td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold line-through opacity-60">
                    {change.before.type}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="bg-muted/50 text-foreground/70 inline-block w-fit rounded px-2 py-1 text-xs font-bold">
                    {change.after.type}
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
