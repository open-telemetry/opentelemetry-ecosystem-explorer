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

  const isSectionActive = (secKey: string) => activePreviewKey === secKey;
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
    <pre
      className={`max-w-full overflow-x-auto [overflow-wrap:anywhere] break-words whitespace-pre-wrap ${className ?? ""}`}
    >
      {headerLines.length > 0 && (
        <span className="block">
          {renderLines(headerLines)}
          {"\n"}
        </span>
      )}

      {fileFormatLines.length > 0 && (
        <span className="block">
          {renderLines(fileFormatLines)}
          {"\n"}
        </span>
      )}

      {sectionsWithTokens.map((sec) => {
        if (sec.key === "legacy") {
          return <Fragment key={sec.key}>{renderLines(sec.lines)}</Fragment>;
        }

        const isActive = isSectionActive(sec.key);
        return (
          <span
            key={sec.key}
            data-yaml-section={sec.key}
            className={`block min-w-max rounded-sm border-l pl-2 transition-colors duration-200 motion-reduce:transition-none ${
              isActive
                ? "border-l-otel-orange bg-otel-orange/10"
                : "border-l-transparent bg-transparent"
            }`}
          >
            {renderLines(sec.lines)}
          </span>
        );
      })}
    </pre>
  );
}
