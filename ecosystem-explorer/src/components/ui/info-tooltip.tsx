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
import { useId, useState, type JSX } from "react";
import { Info } from "lucide-react";

export interface InfoTooltipProps {
  text: string;
  /**
   * Stable id for the tooltip's content element. When provided, consumers can
   * point an input's `aria-describedby` at it. When omitted, an auto-generated
   * id is used.
   */
  describedById?: string;
  className?: string;
}

export function InfoTooltip({
  text,
  describedById,
  className,
}: InfoTooltipProps): JSX.Element | null {
  const autoId = useId();
  const id = describedById ?? autoId;
  const [open, setOpen] = useState(false);
  if (text.trim() === "") return null;

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Description"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40 inline-flex h-4 w-4 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2"
      >
        <Info className="h-3 w-3" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={id}
        data-open={open}
        className={[
          "border-border/60 bg-card text-foreground pointer-events-none absolute top-full left-0 z-20 mt-1 w-max max-w-xs rounded-md border px-2 py-1 text-xs shadow-lg",
          open ? "opacity-100" : "opacity-0",
          "transition-opacity",
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}
