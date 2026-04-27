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
import * as RadixTooltip from "@radix-ui/react-tooltip";
import React, { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";

const TooltipProvider = RadixTooltip.Provider;
const TooltipRoot = RadixTooltip.Root;
const TooltipTrigger = RadixTooltip.Trigger;
const TooltipPortal = RadixTooltip.Portal;

const TooltipContent = forwardRef<
  ComponentRef<typeof RadixTooltip.Content>,
  ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className = "", sideOffset = 4, ...props }, ref) => (
  <TooltipPortal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`z-50 overflow-hidden rounded-md border border-border/50 bg-card/95 px-3 py-1.5 text-xs normal-case text-foreground shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className}`}
      {...props}
    />
  </TooltipPortal>
));
TooltipContent.displayName = RadixTooltip.Content.displayName;

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/**
 * A reusable tooltip component that provides extra information on hover or focus.
 */
export function Tooltip({ children, content, side = "top", className = "" }: TooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {content}
          <RadixTooltip.Arrow className="fill-border/50" />
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
