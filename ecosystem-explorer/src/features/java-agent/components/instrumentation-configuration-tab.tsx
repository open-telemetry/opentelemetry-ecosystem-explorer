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
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Configuration } from "@/types/javaagent";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { ConfigurationCard, type ConfigurationFormat } from "./configuration-card";

interface InstrumentationConfigurationTabProps {
  configurations: Configuration[];
}

export function InstrumentationConfigurationTab({
  configurations,
}: InstrumentationConfigurationTabProps) {
  const { t } = useTranslation("java-agent");
  const [format, setFormat] = useState<ConfigurationFormat>("declarative");
  const formatTabs = [
    { value: "declarative", label: t("configTabs.declarative") },
    { value: "system-property", label: t("configTabs.systemProperties") },
  ];

  if (configurations.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <Settings className="text-muted-foreground/50 mx-auto h-12 w-12" aria-hidden="true" />
          <p className="text-muted-foreground mt-4 text-sm">
            {t("configInstrumentation.noOptions")}
          </p>
        </div>
      </div>
    );
  }

  const hasAnyDeclarativeName = configurations.some((c) => Boolean(c.declarative_name));

  const grid = (cardFormat: ConfigurationFormat) => (
    <div className="grid gap-4 md:grid-cols-2">
      {configurations.map((config) => (
        <ConfigurationCard key={config.name} config={config} format={cardFormat} />
      ))}
    </div>
  );

  if (!hasAnyDeclarativeName) {
    return grid("system-property");
  }

  return (
    <Tabs
      className="space-y-6"
      value={format}
      onValueChange={(v) => setFormat(v as ConfigurationFormat)}
    >
      <SegmentedTabList tabs={formatTabs} value={format} fullWidth />
      <TabsContent value="declarative">{grid("declarative")}</TabsContent>
      <TabsContent value="system-property">{grid("system-property")}</TabsContent>
    </Tabs>
  );
}
