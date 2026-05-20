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
import { Fragment, useMemo, type JSX } from "react";
import { tokenize, type Token } from "@/lib/yaml-highlight";
import type { StructuredYaml } from "@/lib/yaml-generator";

interface YamlCodeBlockProps {
  structured?: StructuredYaml;
  // Plain-string fallback kept for ConfigurationCard, which renders individual config snippets.
  code?: string;
  activePreviewKey?: string | null;
  className?: string;
}

export function YamlCodeBlock({
  structured,
  code,
  activePreviewKey = null,
  className,
}: YamlCodeBlockProps): JSX.Element {
  const finalStructured = useMemo<StructuredYaml>(() => {
    if (structured) return structured;
    if (code !== undefined) {
      return {
        header: "",
        fileFormat: "",
        sections: [{ key: "legacy", content: code }],
      };
    }
    return { header: "", fileFormat: "", sections: [] };
  }, [structured, code]);

  const headerLines = useMemo(() => tokenize(finalStructured.header), [finalStructured.header]);
  const fileFormatLines = useMemo(
    () => tokenize(finalStructured.fileFormat),
    [finalStructured.fileFormat]
  );

  const sectionsWithTokens = useMemo(() => {
    return finalStructured.sections.map((sec) => ({
      key: sec.key,
      lines: tokenize(sec.content),
    }));
  }, [finalStructured.sections]);

  const isSectionActive = (secKey: string) => {
    if (activePreviewKey === secKey) return true;
    if (secKey === "instrumentation/development") {
      return activePreviewKey === "general" || activePreviewKey === "instrumentations";
    }
    return false;
  };

  const renderLines = (lines: Token[][]) => {
    return lines.map((tokens, i) => (
      <Fragment key={i}>
        {tokens.map((t, j) =>
          t.kind === "ws" ? (
            t.text
          ) : (
            <span key={j} className={`y-${t.kind}`}>
              {t.text}
            </span>
          )
        )}
        {i < lines.length - 1 ? "\n" : ""}
      </Fragment>
    ));
  };

  return (
    <pre className={className}>
      {headerLines.length > 0 && (
        <div className="opacity-80">
          {renderLines(headerLines)}
          {"\n"}
        </div>
      )}

      {fileFormatLines.length > 0 && (
        <div>
          {renderLines(fileFormatLines)}
          {"\n"}
        </div>
      )}

      {sectionsWithTokens.map((sec) => {
        const isActive = isSectionActive(sec.key);
        return (
          <div
            key={sec.key}
            data-section-key={sec.key}
            className={`my-1 rounded-sm border-l-2 py-1 pl-3 transition-all duration-300 ${
              isActive
                ? "bg-primary/5 border-primary shadow-[0_0_12px_rgba(var(--primary-hsl),0.05)]"
                : "border-transparent bg-transparent"
            }`}
          >
            {renderLines(sec.lines)}
          </div>
        );
      })}
    </pre>
  );
}
