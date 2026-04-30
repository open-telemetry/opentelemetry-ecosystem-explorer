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
import type { Configuration } from "@/types/javaagent";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import { ConfigurationCard, type ConfigurationFormat } from "./configuration-card";

const FORMAT_TABS = [
  { value: "declarative", label: "Declarative" },
  { value: "system-property", label: "System Properties" },
];

interface InstrumentationConfigurationTabProps {
  configurations: Configuration[];
}

export function InstrumentationConfigurationTab({
  configurations,
}: InstrumentationConfigurationTabProps) {
  const [format, setFormat] = useState<ConfigurationFormat>("declarative");

  if (configurations.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <Settings className="text-muted-foreground/50 mx-auto h-12 w-12" aria-hidden="true" />
          <p className="text-muted-foreground mt-4 text-sm">No configuration options available.</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs
      className="space-y-6"
      value={format}
      onValueChange={(v) => setFormat(v as ConfigurationFormat)}
    >
      <SegmentedTabList tabs={FORMAT_TABS} value={format} />

      <TabsContent value="declarative">
        <div className="grid gap-4 md:grid-cols-2">
          {configurations.map((config) => (
            <ConfigurationCard key={config.name} config={config} format="declarative" />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="system-property">
        <div className="grid gap-4 md:grid-cols-2">
          {configurations.map((config) => (
            <ConfigurationCard key={config.name} config={config} format="system-property" />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
