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
import { ChevronRight } from "lucide-react";
import type { Configuration } from "@/types/javaagent";
import { CopyButton } from "@/components/ui/copy-button";
import { DetailCard } from "@/components/ui/detail-card";
import { GlowBadge } from "@/components/ui/glow-badge";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { YamlCodeBlock } from "../configuration/components/yaml-code-block";
import { formatDeclarativeYaml, getStabilityLabel } from "../utils/format";
import { renderWithInlineCode } from "@/lib/render-inline-code";

export type ConfigurationFormat = "system-property" | "declarative";

interface ConfigurationCardProps {
  config: Configuration;
  format: ConfigurationFormat;
  instrumentations?: string[];
}

export function ConfigurationCard({ config, format, instrumentations }: ConfigurationCardProps) {
  const stability = config.declarative_name ? getStabilityLabel(config.declarative_name) : null;

  const showDeclarative = format === "declarative" && Boolean(config.declarative_name);
  const yamlCode = config.declarative_name
    ? formatDeclarativeYaml(config.declarative_name, "<value>")
    : "";
  const flatName = config.name;
  const copyText = showDeclarative ? yamlCode : flatName;

  const isEmptyDefault =
    config.default === "" || config.default === null || config.default === undefined;
  const defaultValue = isEmptyDefault
    ? "(empty)"
    : typeof config.default === "boolean"
      ? config.default.toString()
      : String(config.default);

  return (
    <DetailCard withHoverEffect>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          {showDeclarative ? (
            <div data-testid="config-name" className="min-w-0 flex-1">
              <YamlCodeBlock
                code={yamlCode}
                className="bg-background/60 text-foreground rounded-md p-3 font-mono text-xs"
              />
            </div>
          ) : (
            <code
              data-testid="config-name"
              className="text-primary flex-1 font-mono text-sm break-all"
            >
              {flatName}
            </code>
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <GlowBadge variant="info" withGlow>
              {config.type}
            </GlowBadge>
            {stability === "development" && <StabilityBadge stability="development" />}
            <CopyButton text={copyText} />
          </div>
        </div>

        {config.description?.trim() && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {renderWithInlineCode(config.description)}
          </p>
        )}

        <div className="border-border/30 bg-muted/30 flex items-start gap-2 rounded-lg border p-3">
          <span className="text-muted-foreground shrink-0 text-xs font-medium">Default:</span>
          <code className="flex-1 text-xs break-all">{defaultValue}</code>
        </div>

        {config.example && config.example.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground text-xs font-medium">Examples:</span>
            {config.example.map((ex, i) => (
              <div key={i} className="border-border/30 bg-muted/30 rounded-lg border px-3 py-2">
                <code className="text-xs break-all">{ex}</code>
              </div>
            ))}
          </div>
        )}

        {instrumentations && instrumentations.length > 0 && (
          <div className="border-border/50 text-muted-foreground mt-4 border-t pt-3 text-xs">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="text-foreground hover:text-primary flex cursor-pointer list-none items-center gap-1 font-semibold select-none">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                {instrumentations.length} Instrumentation{instrumentations.length === 1 ? "" : "s"}{" "}
                using this configuration
              </summary>
              <div className="mt-3 flex flex-wrap gap-1.5 pl-4">
                {instrumentations.map((inst) => (
                  <span
                    key={inst}
                    className="bg-muted/50 border-border/50 rounded-md border px-2 py-1 text-[10px] font-medium"
                  >
                    {inst}
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </DetailCard>
  );
}
