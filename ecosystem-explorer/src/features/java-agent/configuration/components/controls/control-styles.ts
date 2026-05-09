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
 * Tailwind class string for full-size `<input>` controls (text, number).
 * Reused by TextInputControl and NumberInputControl so a styling change
 * touches one place.
 */
export const INPUT_CLASS =
  "w-full rounded-lg border border-border/60 bg-background/80 px-4 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 [color-scheme:dark]";

/**
 * Compact variant used by list-of-input controls (string-list, number-list)
 * where each row needs a tighter vertical rhythm than a standalone input.
 */
export const LIST_INPUT_CLASS =
  "w-full rounded-lg border border-border/60 bg-background/80 px-4 py-2 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 [color-scheme:dark]";
