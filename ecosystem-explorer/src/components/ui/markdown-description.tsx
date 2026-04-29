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
import type { ComponentProps, JSX } from "react";
import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownDescriptionProps {
  text: string;
  className?: string;
  /** When true, do not wrap output in a `<div>` and unwrap the top-level `<p>`
   *  so the rendered nodes flow inline with surrounding text. */
  inline?: boolean;
}

const ALLOWED = ["p", "ul", "ol", "li", "a", "strong", "em", "code"];

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

export function MarkdownDescription({
  text,
  className,
  inline,
}: MarkdownDescriptionProps): JSX.Element | null {
  if (text.trim() === "") return null;
  if (inline) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{ a: Anchor, p: Fragment }}
      >
        {text}
      </ReactMarkdown>
    );
  }
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{ a: Anchor }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
