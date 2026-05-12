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
import { useMemo, type JSX } from "react";
import type { InstrumentationModule } from "@/types/javaagent";
import { aggregateConfigurations } from "@/lib/configurations-aggregate";
import { InstrumentationConfigField } from "./instrumentation-config-field";

export interface InstrumentationConfigFormProps {
  module: InstrumentationModule;
  onJumpToGeneral: (sectionKey: string) => void;
}

export function InstrumentationConfigForm({
  module: mod,
  onJumpToGeneral,
}: InstrumentationConfigFormProps): JSX.Element {
  const aggregated = useMemo(() => aggregateConfigurations(mod), [mod]);

  if (aggregated.length === 0) {
    return (
      <p className="text-muted-foreground border-border/40 bg-background/30 rounded-md border border-dashed px-3 py-3 text-xs">
        No configurable options for this module.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {aggregated.map((cfg) => (
        <InstrumentationConfigField
          key={cfg.entry.declarative_name}
          config={cfg}
          onJumpToGeneral={onJumpToGeneral}
        />
      ))}
    </div>
  );
}
