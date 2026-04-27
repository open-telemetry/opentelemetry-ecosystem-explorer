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

export interface TruncatedDescription {
  summary: string;
  rest: string | null;
}

const SENTENCE_END_RE = /[.!?](?=\s|$)/;

/**
 * Split `text` into a short summary and an optional remainder.
 *
 * Rule: prefer the first sentence (terminator followed by whitespace or
 * end-of-string). If that prefix exceeds `maxChars`, hard-cap at the last
 * word boundary at or before `maxChars`. If the chosen cut covers the whole
 * input, return `rest: null`.
 *
 * Schema-driven: never inspects the source key; works on any description.
 */
export function truncateDescription(text: string, maxChars = 200): TruncatedDescription {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { summary: "", rest: null };
  }

  const match = trimmed.match(SENTENCE_END_RE);
  let cut = match && match.index !== undefined ? match.index + 1 : trimmed.length;

  if (cut > maxChars) {
    const slice = trimmed.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(" ");
    cut = lastSpace > 0 ? lastSpace : maxChars;
  }

  if (cut >= trimmed.length) {
    return { summary: trimmed, rest: null };
  }

  return {
    summary: trimmed.slice(0, cut).trim(),
    rest: trimmed.slice(cut).trim(),
  };
}
