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
import type { Configuration } from "@/types/javaagent";
import { CopyButton } from "@/components/ui/copy-button";
import { DetailCard } from "@/components/ui/detail-card";
import { GlowBadge } from "@/components/ui/glow-badge";
import { StabilityBadge } from "@/components/ui/stability-badge";
import { YamlCodeBlock } from "../configuration/components/yaml-code-block";
import { formatDeclarativeYaml, getStabilityLabel } from "../utils/format";

export type ConfigurationFormat = "system-property" | "declarative";

interface ConfigurationCardProps {
  config: Configuration;
  format: ConfigurationFormat;
}

export function ConfigurationCard({ config, format }: ConfigurationCardProps) {
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

        <p className="text-muted-foreground text-sm leading-relaxed">{config.description}</p>

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
      </div>
    </DetailCard>
  );
}
