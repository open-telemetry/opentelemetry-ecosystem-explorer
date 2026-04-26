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

export type TokenKind =
  | "comment"
  | "key"
  | "string"
  | "number"
  | "keyword"
  | "punct"
  | "plain"
  | "ws";

export interface Token {
  kind: TokenKind;
  text: string;
}

const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;
// Lowercase only: js-yaml `dump` emits canonical lowercase booleans/null.
// Mixed-case `True` / `NULL` would be plain unquoted scalars, not keywords.
const KEYWORD_RE = /^(?:true|false|null|~|yes|no)$/;
// Bare-key regex: a key may not start with `:`, `#`, whitespace, or quote
// characters (those route to KV_QUOTED_RE), and may not contain `:`.
const KV_BARE_RE = /^([^:#\s"'][^:]*?)(\s*:)(\s*)(.*)$/;
// Quoted-key regex: handles `"odd:key": value` and single-quoted variants.
const KV_QUOTED_RE = /^("(?:\\.|[^"\\])*"|'(?:''|[^'])*')(\s*:)(\s*)(.*)$/;
const QUOTED_RE = /^(?:"(?:\\.|[^"\\])*"|'(?:''|[^'])*')/;

/**
 * Tokenize block-style YAML one line at a time.
 *
 * The Configuration Builder's emitter (`generateYaml` via js-yaml `dump` with
 * `lineWidth: -1`, `noRefs: true`, `quotingType: '"'`) only ever produces
 * block style with no anchors, refs, or multi-line strings. The lexer is
 * tuned for that subset; anything else (e.g. flow `[a, b]`) degrades to
 * `plain` rather than crashing.
 */
export function tokenize(yaml: string): Token[][] {
  // `"".split("\n")` returns `[""]`, not `[]`, so without this short-circuit
  // an empty document would emit a single empty line of tokens.
  if (yaml === "") return [];
  return yaml.split("\n").map(tokenizeLine);
}

function tokenizeLine(line: string): Token[] {
  const out: Token[] = [];
  let rest = line;

  const wsMatch = rest.match(/^[ \t]+/);
  if (wsMatch) {
    out.push({ kind: "ws", text: wsMatch[0] });
    rest = rest.slice(wsMatch[0].length);
  }

  if (rest.startsWith("#")) {
    out.push({ kind: "comment", text: rest });
    return out;
  }

  if (rest === "-" || rest.startsWith("- ")) {
    out.push({ kind: "punct", text: "-" });
    rest = rest.slice(1);
    if (rest.startsWith(" ")) {
      const wsRun = rest.match(/^ +/)?.[0] ?? "";
      out.push({ kind: "ws", text: wsRun });
      rest = rest.slice(wsRun.length);
      if (rest.length === 0) return out;
      out.push(...tokenizeLine(rest));
      return out;
    }
    return out;
  }

  const kvMatch = rest.match(KV_QUOTED_RE) ?? rest.match(KV_BARE_RE);
  if (kvMatch) {
    const [, key, colonRun, gap, value] = kvMatch;
    out.push({ kind: "key", text: key });
    const colonIdx = colonRun.indexOf(":");
    if (colonIdx > 0) out.push({ kind: "ws", text: colonRun.slice(0, colonIdx) });
    out.push({ kind: "punct", text: ":" });
    if (gap.length > 0) out.push({ kind: "ws", text: gap });
    if (value.length > 0) out.push(...tokenizeValue(value));
    return out;
  }

  if (rest.length > 0) out.push(...tokenizeValue(rest));
  return out;
}

function tokenizeValue(value: string): Token[] {
  const out: Token[] = [];

  const quotedMatch = value.match(QUOTED_RE);
  if (quotedMatch) {
    out.push({ kind: "string", text: quotedMatch[0] });
    const tail = value.slice(quotedMatch[0].length);
    if (tail.length === 0) return out;
    const tailComment = tail.match(/^(\s+)(#.*)$/);
    if (tailComment) {
      out.push({ kind: "ws", text: tailComment[1] });
      out.push({ kind: "comment", text: tailComment[2] });
      return out;
    }
    out.push({ kind: "ws", text: tail });
    return out;
  }

  let main = value;
  let trailingComment: string | null = null;
  const commentMatch = main.match(/^(.*?)(\s+#.*)$/);
  if (commentMatch) {
    main = commentMatch[1];
    trailingComment = commentMatch[2];
  }

  const trimmed = main.trim();
  if (trimmed === "") {
    if (main.length > 0) out.push({ kind: "ws", text: main });
    if (trailingComment) out.push({ kind: "comment", text: trailingComment });
    return out;
  }

  let kind: TokenKind;
  if (NUMBER_RE.test(trimmed)) kind = "number";
  else if (KEYWORD_RE.test(trimmed)) kind = "keyword";
  else kind = "plain";

  const leadMatch = main.match(/^\s+/);
  const tailMatch = main.match(/\s+$/);
  if (leadMatch) out.push({ kind: "ws", text: leadMatch[0] });
  out.push({ kind, text: trimmed });
  if (tailMatch) out.push({ kind: "ws", text: tailMatch[0] });
  if (trailingComment) out.push({ kind: "comment", text: trailingComment });
  return out;
}
