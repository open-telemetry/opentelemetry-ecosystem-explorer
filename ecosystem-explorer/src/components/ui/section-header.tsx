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

interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
}

export function SectionHeader({ children, className = "" }: SectionHeaderProps) {
  return (
    <div className={`mb-6 flex items-center justify-center gap-4 ${className}`}>
      <div
        className="h-px w-16"
        style={{
          background: "linear-gradient(to right, transparent, hsl(var(--color-border)))",
        }}
      />
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
      <div
        className="h-px w-16"
        style={{
          background: "linear-gradient(to left, transparent, hsl(var(--color-border)))",
        }}
      />
    </div>
  );
}
