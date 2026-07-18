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

/*
 * TypeStripe — 4px left-edge color stripe used to flag the OTel-collector
 * component type at the leading edge of cards, list rows, and detail headers.
 *
 * Five canonical types: receiver / processor / exporter / connector /
 * extension. Color mapping lives in `./type-stripe-colors.ts` (split out so
 * React Fast Refresh stays happy).
 *
 * Two consumers:
 *   1. As a slot inside `<DetailCard typeStripe="...">` — DetailCard mounts
 *      `<TypeStripe>` with its own positioning className, so the stripe
 *      rendering stays in one place.
 *   2. As a standalone `<TypeStripe type="..." />` for list rows that don't
 *      use DetailCard (e.g. compact list view in Phase 4).
 */

import { type CollectorComponentType, TYPE_STRIPE_COLORS } from "./type-stripe-colors";

export interface TypeStripeProps {
  type: CollectorComponentType;
  className?: string;
}

export function TypeStripe({ type, className }: TypeStripeProps) {
  return (
    <span
      aria-hidden
      className={className ? `type-stripe ${className}` : "type-stripe"}
      data-type={type}
      style={{ backgroundColor: TYPE_STRIPE_COLORS[type] }}
    />
  );
}
