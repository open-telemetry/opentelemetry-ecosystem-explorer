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
import type { JSX } from "react";

interface StabilityBadgeProps {
  stability: "development" | undefined;
}

/**
 * "dev" pill rendered next to schema labels with `stability: "development"`.
 * Used by GroupRenderer (top-level cards) and ControlWrapper (leaf fields).
 */
export function StabilityBadge({ stability }: StabilityBadgeProps): JSX.Element | null {
  if (stability !== "development") return null;
  return (
    <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-500">dev</span>
  );
}
