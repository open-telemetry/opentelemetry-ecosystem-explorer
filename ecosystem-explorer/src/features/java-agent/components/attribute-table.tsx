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
import { useState } from "react";
import type { Attribute } from "@/types/javaagent";
import { ChevronDown } from "lucide-react";

interface AttributeTableProps {
  attributes: Attribute[];
  expandVersion?: number;
  collapseVersion?: number;
}

export function AttributeTable({ attributes, expandVersion = 0, collapseVersion = 0 }: AttributeTableProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prevExpand, setPrevExpand] = useState(expandVersion);
  const [prevCollapse, setPrevCollapse] = useState(collapseVersion);

  if (expandVersion > prevExpand) {
    setPrevExpand(expandVersion);
    setIsOpen(true);
  }

  if (collapseVersion > prevCollapse) {
    setPrevCollapse(collapseVersion);
    setIsOpen(false);
  }

  if (attributes.length === 0) {
    return null;
  }

  return (
    <details 
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      className="group border-border/30 bg-card/50 overflow-hidden rounded-lg border open:bg-transparent"
    >
      <summary className="hover:bg-card/80 flex cursor-pointer items-center justify-between p-3 text-sm font-medium transition-colors">
        <span className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
          View {attributes.length} Attribute{attributes.length === 1 ? "" : "s"}
        </span>
        <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-border/30 overflow-x-auto border-t">
        <table aria-label="Attributes" className="w-full min-w-[260px] border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th
                scope="col"
                className="text-muted-foreground p-2 text-left text-[10px] font-bold tracking-widest uppercase sm:p-3"
              >
                Key
              </th>
              <th
                scope="col"
                className="text-muted-foreground p-2 text-left text-[10px] font-bold tracking-widest uppercase sm:p-3"
              >
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr, index) => (
              <tr
                key={attr.name}
                className={`attribute-row ${index % 2 === 1 ? "bg-white/[0.03]" : ""}`}
              >
                <td className="p-2 font-mono text-xs sm:p-4 sm:text-sm">{attr.name}</td>
                <td className="p-2 sm:p-4">
                  <span className="border-border/30 bg-card/80 text-muted-foreground inline-block w-fit rounded border px-2 py-1 text-xs font-bold tracking-wider uppercase">
                    {attr.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
