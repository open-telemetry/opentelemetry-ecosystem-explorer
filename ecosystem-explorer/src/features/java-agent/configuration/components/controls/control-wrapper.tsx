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
import type { ConfigNodeBase, Constraints } from "@/types/configuration";
import type { ConfigValue } from "@/types/configuration-builder";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { FieldMeta } from "./field-meta";

interface ControlWrapperProps {
  node: ConfigNodeBase;
  inputId?: string;
  descriptionId?: string;
  isNull?: boolean;
  error?: string | null;
  /** Clears the field (sets value to null). Triggered by the Reset link. */
  onClear?: () => void;
  /**
   * When true, render the children inline with the label (right-aligned)
   * instead of stacking the input below. Used by boolean leaf controls
   * (ToggleControl, FlagControl) so the switch sits on the label row.
   */
  inlineControl?: boolean;
  /**
   * Describes the schema's default for this field. When `isNull` is true,
   * the wrapper renders a "default" badge alongside the children. The leaf
   * control is responsible for using `value` to position itself in the
   * inferred-default state.
   */
  defaultPreview?: { value: ConfigValue | null; description: string };
  children: ReactNode;
}

function DefaultBadge() {
  return (
    <span className="border-border/60 text-muted-foreground rounded border border-dashed px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase">
      default
    </span>
  );
}

function ResetLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-primary text-xs font-medium hover:underline"
    >
      Reset
    </button>
  );
}

export function ControlWrapper({
  node,
  inputId,
  descriptionId,
  isNull = false,
  error,
  onClear,
  inlineControl = false,
  defaultPreview,
  children,
}: ControlWrapperProps) {
  const isUnset = node.nullable === true && isNull;
  const showReset = node.nullable === true && !isNull && !!onClear;
  const trailing: ReactNode = isUnset ? (
    <DefaultBadge />
  ) : showReset ? (
    <ResetLink onClick={onClear!} />
  ) : null;

  const fieldMetaDefault =
    isUnset && defaultPreview ? defaultPreview.description : node.defaultBehavior;

  return (
    <div className="space-y-2">
      {!node.hideLabel && (
        <div className="flex items-center gap-2">
          {inputId ? (
            <label htmlFor={inputId} className="text-foreground text-sm font-medium">
              {node.label}
            </label>
          ) : (
            <span className="text-foreground text-sm font-medium">{node.label}</span>
          )}
          {node.required && (
            <span className="text-sm text-red-400" aria-hidden="true">
              *
            </span>
          )}
          <StabilityBadge stability={node.stability} />
          {node.description && (
            <InfoTooltip text={node.description} describedById={descriptionId} />
          )}
          {inlineControl && (
            <span className="ml-auto inline-flex items-center gap-2">
              {children}
              {trailing}
            </span>
          )}
        </div>
      )}
      {!inlineControl && (
        <div className="flex items-start gap-2">
          <div className="flex-1">{children}</div>
          {trailing && <span className="mt-0.5 shrink-0 py-1">{trailing}</span>}
        </div>
      )}
      <FieldMeta
        node={{
          defaultBehavior: fieldMetaDefault,
          constraints: (node as ConfigNodeBase & { constraints?: Constraints }).constraints,
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
