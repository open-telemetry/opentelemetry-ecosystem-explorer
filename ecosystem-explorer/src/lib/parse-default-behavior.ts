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

/**
 * Heuristic parser for the schema's free-text `defaultBehavior` field.
 * Returns the typed default when the prose follows the canonical
 * "<value> is used" / "<value> is …" pattern, or null when the text
 * doesn't unambiguously encode a boolean.
 *
 * This is a deliberate fallback for the (current) absence of a typed
 * `default: boolean` field on the upstream OTel JSON-Schema. Once that
 * lands the helper can be deleted.
 */
export function parseBooleanDefault(text: string | undefined): boolean | null {
  if (!text) return null;
  if (/^\s*true is\b/i.test(text)) return true;
  if (/^\s*false is\b/i.test(text)) return false;
  return null;
}
