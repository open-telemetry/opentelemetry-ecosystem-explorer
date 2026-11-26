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
import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/ui/copy-button";
import { GlowBadge } from "@/components/ui/glow-badge";
import { MarkdownDescription } from "@/components/ui/markdown-description";
import type { ContribSetting, SettingDefault } from "@/types/java-contrib";

interface ContribSettingsTableProps {
  settings: ContribSetting[];
  /**
   * `<location>.<component_key>` for declarative methods with placement. When set, each setting
   * shows its full display path, e.g. `tracer_provider.processors[].stacktrace/development.min_duration`.
   */
  pathPrefix?: string;
}

function formatDefault(value: Exclude<SettingDefault, null>): string {
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/*
 * Rendered as a stacked list rather than a <table> so long property names and descriptions
 * stay readable at phone width without horizontal scrolling.
 */
export function ContribSettingsTable({ settings, pathPrefix }: ContribSettingsTableProps) {
  const { t } = useTranslation("java-agent");

  if (settings.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        {t("contrib.detail.configuration.noSettings")}
      </p>
    );
  }

  return (
    <ul className="divide-border/60 border-border/60 divide-y rounded-md border">
      {settings.map((setting, i) => {
        const fullPath = pathPrefix ? `${pathPrefix}.${setting.name}` : null;
        return (
          // Index is part of the key because duplicate names are reported, not rejected.
          <li key={`${i}:${setting.name}`} className="space-y-2 p-4" data-testid="contrib-setting">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-primary min-w-0 font-mono text-sm break-all">
                {setting.name}
              </code>
              <CopyButton text={setting.name} />
            </div>
            {fullPath && (
              <p className="text-muted-foreground text-xs">
                <span className="sr-only">{t("contrib.detail.configuration.fullPath")}: </span>
                <code className="font-mono break-all">{fullPath}</code>
              </p>
            )}
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground">{t("contrib.detail.configuration.type")}</dt>
                <dd>
                  <GlowBadge variant="muted">{setting.type}</GlowBadge>
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground">
                  {t("contrib.detail.configuration.default")}
                </dt>
                <dd>
                  {setting.default === null ? (
                    <span className="text-muted-foreground italic">
                      {t("contrib.detail.configuration.notSet")}
                    </span>
                  ) : (
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono break-all">
                      {formatDefault(setting.default)}
                    </code>
                  )}
                </dd>
              </div>
              {setting.unit && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">
                    {t("contrib.detail.configuration.unit")}
                  </dt>
                  <dd>
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono">{setting.unit}</code>
                  </dd>
                </div>
              )}
            </dl>
            {setting.allowed_values && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">
                  {t("contrib.detail.configuration.allowedValues")}
                </span>
                {setting.allowed_values.map((value) => (
                  <code key={value} className="bg-muted rounded px-1.5 py-0.5 font-mono">
                    {value}
                  </code>
                ))}
              </div>
            )}
            <MarkdownDescription
              text={setting.description}
              className="text-muted-foreground text-sm leading-relaxed"
            />
          </li>
        );
      })}
    </ul>
  );
}
