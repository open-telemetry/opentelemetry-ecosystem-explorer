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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { MarkdownDescription } from "@/components/ui/markdown-description";
import type { ContribConfiguration } from "@/types/java-contrib";
import { ContribCodeBlock } from "./contrib-code-block";
import { ContribSettingsTable } from "./contrib-settings-table";

interface ContribConfigurationSectionProps {
  configurations: ContribConfiguration[];
}

/*
 * Methods are alternatives, so each one gets its own tab with its own example and settings;
 * settings are never merged across methods. Tabs are keyed by index because the format does not
 * forbid two methods of the same type.
 */
export function ContribConfigurationSection({ configurations }: ContribConfigurationSectionProps) {
  const { t } = useTranslation("java-agent");
  const [active, setActive] = useState("0");

  if (configurations.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        {t("contrib.detail.configuration.none")}
      </p>
    );
  }

  return (
    <Tabs value={active} onValueChange={setActive}>
      {configurations.length > 1 && (
        <div className="overflow-x-auto pb-1">
          <SegmentedTabList
            tabs={configurations.map((config, i) => ({
              value: String(i),
              label: config.display_name,
            }))}
            value={active}
          />
        </div>
      )}
      {configurations.map((config, i) => {
        const pathPrefix =
          config.component_key && config.location
            ? `${config.location}.${config.component_key}`
            : undefined;
        return (
          <TabsContent key={i} value={String(i)} className="mt-4 space-y-5">
            {configurations.length === 1 && (
              <h3 className="text-foreground text-base font-semibold">{config.display_name}</h3>
            )}
            <MarkdownDescription
              text={config.description}
              className="text-muted-foreground text-sm leading-relaxed"
            />
            {config.component_key && config.location && (
              <dl className="border-border/60 bg-muted/30 grid gap-x-4 gap-y-1 rounded-md border p-3 text-xs sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">
                  {t("contrib.detail.configuration.location")}
                </dt>
                <dd>
                  <code className="font-mono break-all">{config.location}</code>
                </dd>
                <dt className="text-muted-foreground">
                  {t("contrib.detail.configuration.componentKey")}
                </dt>
                <dd>
                  <code className="font-mono break-all">{config.component_key}</code>
                </dd>
              </dl>
            )}
            <div className="space-y-2">
              <h4 className="text-foreground text-sm font-semibold">
                {t("contrib.detail.configuration.example")}
              </h4>
              <ContribCodeBlock code={config.example.code} language={config.example.language} />
            </div>
            <div className="space-y-2">
              <h4 className="text-foreground text-sm font-semibold">
                {t("contrib.detail.configuration.settings", { count: config.settings.length })}
              </h4>
              <ContribSettingsTable settings={config.settings} pathPrefix={pathPrefix} />
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
