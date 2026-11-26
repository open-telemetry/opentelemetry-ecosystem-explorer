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
import { CopyButton } from "@/components/ui/copy-button";
import { YamlCodeBlock } from "@/features/java-agent/configuration/components/yaml-code-block";

const CODE_CLASS =
  "bg-background/60 text-foreground p-4 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap";

interface ContribCodeBlockProps {
  code: string;
  language: string;
}

/** Only YAML gets highlighting; the app has no general-purpose highlighter. */
export function ContribCodeBlock({ code, language }: ContribCodeBlockProps) {
  return (
    <div className="border-border/60 overflow-hidden rounded-md border">
      <div className="border-border/60 bg-muted/40 flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground font-mono text-xs">{language}</span>
        <CopyButton text={code} />
      </div>
      {language === "yaml" ? (
        <YamlCodeBlock code={code} className={CODE_CLASS} />
      ) : (
        <pre className={CODE_CLASS}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
