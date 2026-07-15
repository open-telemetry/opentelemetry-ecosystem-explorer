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
import type { JSX, ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryReadme } from "@/hooks/use-javaagent-data";

interface StandaloneLibraryTabProps {
  name: string;
  markdownHash: string;
}

function Anchor({ href, children, ...rest }: ComponentProps<"a">): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary [overflow-wrap:anywhere] underline-offset-2 hover:underline"
      {...rest}
    >
      {children}
    </a>
  );
}

function Code({ children, className, ...rest }: ComponentProps<"code">): JSX.Element {
  const isBlock = className?.includes("language-");
  if (isBlock) {
    return (
      <pre className="bg-muted/50 border-border overflow-x-auto rounded-md border p-4 text-sm">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    );
  }
  return (
    <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-[0.85em]" {...rest}>
      {children}
    </code>
  );
}

export function StandaloneLibraryTab({
  name,
  markdownHash,
}: StandaloneLibraryTabProps): JSX.Element {
  const { t } = useTranslation("java-agent");
  const { data: markdown, loading, error } = useLibraryReadme(name, markdownHash);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="text-muted-foreground ml-2 text-sm">{t("standaloneLibrary.loading")}</span>
      </div>
    );
  }

  if (error || !markdown) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2 py-16 text-center">
        <AlertCircle className="text-muted-foreground h-8 w-8 opacity-50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">{t("standaloneLibrary.error")}</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: Anchor,
          code: Code,
          // Downshift README headings h1–h3 one level: the page already owns the sole
          // <h1> (the instrumentation name), so the rendered document keeps a
          // single top-level heading. Styling classes are unchanged.
          h1: ({ children }) => (
            <h2 className="text-foreground mt-6 mb-3 text-2xl font-bold first:mt-0">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="text-foreground mt-5 mb-2 text-xl font-semibold">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-foreground mt-4 mb-2 text-base font-semibold">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-foreground/80 mb-3 text-sm leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-foreground/80 mb-3 list-disc space-y-1 pl-5 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-foreground/80 mb-3 list-decimal space-y-1 pl-5 text-sm">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="border-border w-full border-collapse border text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-border bg-muted/50 border px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-border border px-3 py-2">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-primary/30 text-muted-foreground my-3 border-l-4 pl-4 text-sm italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
