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
import { GlowBadge } from "./glow-badge";

const STABILITY_VARIANT = {
  development: "secondary",
  alpha: "warning",
  beta: "info",
  stable: "success",
  deprecated: "error",
  unmaintained: "error",
} as const;

const STABILITY_LABEL = {
  development: "Development",
  alpha: "Alpha",
  beta: "Beta",
  stable: "Stable",
  deprecated: "Deprecated",
  unmaintained: "Unmaintained",
} as const;

export type Stability = keyof typeof STABILITY_VARIANT;

interface StatusPillProps {
  stability: Stability;
  className?: string;
}

export function StatusPill({ stability, className }: StatusPillProps) {
  return (
    <GlowBadge variant={STABILITY_VARIANT[stability]} className={className}>
      {STABILITY_LABEL[stability]}
    </GlowBadge>
  );
}
