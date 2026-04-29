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
import { useId, useMemo, useState, type JSX } from "react";
import { truncateDescription } from "@/lib/truncate-description";
import { MarkdownDescription } from "./markdown-description";

interface TruncatedDescriptionProps {
  text: string;
  className?: string;
  maxChars?: number;
}

export function TruncatedDescription({
  text,
  className,
  maxChars,
}: TruncatedDescriptionProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  const tailId = useId();
  const { summary, rest } = useMemo(() => truncateDescription(text, maxChars), [text, maxChars]);
  if (summary === "") return null;

  return (
    <div className={className ?? "text-muted-foreground text-xs"}>
      <p>
        <MarkdownDescription text={summary} inline />
        {rest !== null && (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-controls={tailId}
              className="text-primary underline-offset-2 hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          </>
        )}
      </p>
      {rest !== null && (
        <div id={tailId} data-testid="truncated-rest" hidden={!expanded}>
          <MarkdownDescription text={rest} />
        </div>
      )}
    </div>
  );
}
