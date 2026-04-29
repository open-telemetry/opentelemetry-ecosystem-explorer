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
import * as HoverCard from "@radix-ui/react-hover-card";
import { MarkdownDescription } from "./markdown-description";

export interface InfoTooltipProps {
  text: string;
  /**
   * Stable id for the screen-reader description element. When provided,
   * consumers can point an input's `aria-describedby` at it. When omitted,
   * an auto-generated id is used.
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
    <span className={`relative inline-flex ${className ?? ""}`}>
      <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={100} closeDelay={150}>
        <HoverCard.Trigger asChild>
          <button
            type="button"
            aria-label="Description"
            aria-describedby={id}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40 inline-flex h-4 w-4 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2"
          >
            <Info className="h-3 w-3" aria-hidden="true" />
          </button>
        </HoverCard.Trigger>
        <span id={id} className="sr-only">
          {text}
        </span>
        <HoverCard.Portal>
          <HoverCard.Content
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className={[
              "border-border/60 bg-card text-foreground z-20 w-max max-w-xs rounded-md border px-2 py-1 text-xs shadow-lg",
              "[&_li]:my-0 [&_p]:my-0.5 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4",
            ].join(" ")}
          >
            <MarkdownDescription text={text} />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </span>
  );
}
