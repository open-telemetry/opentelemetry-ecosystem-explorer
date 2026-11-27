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
import { ExternalLink } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabList } from "@/components/ui/segmented-tabs";
import type { ContribComponent } from "@/types/java-contrib";
import { ContribCodeBlock } from "./contrib-code-block";

type BuildTool = "gradle" | "maven";

interface ContribInstallSnippetProps {
  artifact: NonNullable<ContribComponent["artifact"]>;
}

/*
 * The metadata format carries coordinates but no version, so the snippets use a VERSION placeholder
 * and link to Maven Central for the available releases.
 */
export function ContribInstallSnippet({ artifact }: ContribInstallSnippetProps) {
  const { t } = useTranslation("java-agent");
  const [tool, setTool] = useState<BuildTool>("gradle");
  const { group_id, artifact_id } = artifact;

  const gradle = `implementation("${group_id}:${artifact_id}:VERSION")`;
  const maven = [
    "<dependency>",
    `  <groupId>${group_id}</groupId>`,
    `  <artifactId>${artifact_id}</artifactId>`,
    "  <version>VERSION</version>",
    "</dependency>",
  ].join("\n");
  const centralUrl = `https://central.sonatype.com/artifact/${encodeURIComponent(group_id)}/${encodeURIComponent(artifact_id)}`;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <code className="bg-muted text-foreground rounded px-2 py-1 font-mono text-xs break-all">
          {group_id}:{artifact_id}
        </code>
      </p>
      <Tabs value={tool} onValueChange={(v) => setTool(v as BuildTool)}>
        <SegmentedTabList
          tabs={[
            { value: "gradle", label: t("contrib.detail.install.gradle") },
            { value: "maven", label: t("contrib.detail.install.maven") },
          ]}
          value={tool}
        />
        <TabsContent value="gradle" className="mt-3">
          <ContribCodeBlock code={gradle} language="kotlin" />
        </TabsContent>
        <TabsContent value="maven" className="mt-3">
          <ContribCodeBlock code={maven} language="xml" />
        </TabsContent>
      </Tabs>
      <a
        href={centralUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
      >
        {t("contrib.detail.install.mavenCentral")}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}
