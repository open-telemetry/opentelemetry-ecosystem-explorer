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

interface SectionDividerProps {
  children: ReactNode;
}

export function SectionDivider({ children }: SectionDividerProps) {
  return (
    <div className="my-12 flex items-center">
      <div className="flex-1 border-b-2 border-border/30" />
      <span className="px-8 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </span>
      <div className="flex-1 border-b-2 border-border/30" />
    </div>
  );
}
