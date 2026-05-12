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
import type { Attribute } from "@/types/javaagent";

interface AttributeTableProps {
  attributes: Attribute[];
}

export function AttributeTable({ attributes }: AttributeTableProps) {
  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="border-border/30 overflow-x-auto rounded-lg border">
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
  );
}
