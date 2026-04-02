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
import type { ReactNode } from "react";
import type { ConfigNodeBase } from "@/types/configuration";

interface ControlWrapperProps {
  node: ConfigNodeBase;
  inputId?: string;
  descriptionId?: string;
  isNull?: boolean;
  onClear?: () => void;
  onActivate?: () => void;
  children: ReactNode;
}

export function ControlWrapper({
  node,
  inputId,
  descriptionId,
  isNull = false,
  onClear,
  onActivate,
  children,
}: ControlWrapperProps) {
  const showNullState = node.nullable && isNull && !!onActivate;
  const showClearButton = node.nullable && !isNull && !!onClear;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {inputId ? (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {node.label}
          </label>
        ) : (
          <span className="text-sm font-medium text-foreground">{node.label}</span>
        )}
        {node.required && (
          <span className="text-sm text-red-400" aria-hidden="true">
            *
          </span>
        )}
        {node.stability === "development" && (
          <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-500">
            dev
          </span>
        )}
      </div>
      {node.description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {node.description}
        </p>
      )}
      {showNullState ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground/70">
            {node.nullBehavior ?? node.defaultBehavior ?? "Using default"}
          </span>
          <button
            type="button"
            onClick={onActivate}
            className="rounded-md border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
          >
            Set value
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex-1">{children}</div>
          {showClearButton && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear value"
              className="mt-0.5 shrink-0 rounded-md border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {node.defaultBehavior && !showNullState && (
        <p className="text-xs text-muted-foreground/70">Default: {node.defaultBehavior}</p>
      )}
    </div>
  );
}
