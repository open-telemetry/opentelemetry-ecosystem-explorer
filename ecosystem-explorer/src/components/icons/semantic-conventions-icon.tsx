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
export function SemanticConventionsIcon({ className }: { className?: string }) {
  // Always rendered next to a visible title, so it stays out of the accessibility tree.
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <line
        x1="20"
        y1="150"
        x2="180"
        y2="150"
        stroke="hsl(var(--otel-purple-hsl))"
        strokeWidth="3"
      />

      <circle cx="35" cy="150" r="8" fill="hsl(var(--otel-purple-hsl))" opacity="0.6" />
      <circle
        cx="80"
        cy="150"
        r="10"
        fill="none"
        stroke="hsl(var(--otel-purple-hsl))"
        strokeWidth="3"
      />
      <circle cx="130" cy="150" r="12" fill="hsl(var(--otel-purple-hsl))" opacity="0.8" />
      <rect
        x="158"
        y="128"
        width="24"
        height="24"
        fill="none"
        stroke="hsl(var(--otel-purple-hsl))"
        strokeWidth="3"
      />

      <line x1="35" y1="142" x2="35" y2="70" stroke="hsl(var(--otel-purple-hsl))" strokeWidth="2" />
      <line x1="80" y1="140" x2="80" y2="45" stroke="hsl(var(--otel-purple-hsl))" strokeWidth="2" />
      <line
        x1="130"
        y1="138"
        x2="130"
        y2="95"
        stroke="hsl(var(--otel-purple-hsl))"
        strokeWidth="2"
      />

      <rect
        x="15"
        y="55"
        width="40"
        height="16"
        rx="3"
        fill="hsl(var(--otel-purple-hsl))"
        opacity="0.6"
      />
      <rect
        x="58"
        y="28"
        width="44"
        height="16"
        rx="3"
        fill="none"
        stroke="hsl(var(--otel-purple-hsl))"
        strokeWidth="2"
      />
      <rect
        x="108"
        y="78"
        width="44"
        height="16"
        rx="3"
        fill="hsl(var(--otel-purple-hsl))"
        opacity="0.8"
      />
    </svg>
  );
}
