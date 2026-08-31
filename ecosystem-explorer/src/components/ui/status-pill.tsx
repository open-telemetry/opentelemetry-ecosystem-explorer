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
import { useTranslation } from "react-i18next";
import { GlowBadge } from "./glow-badge";

/* `label` is an i18n key in the `common` namespace (`stability.*`), resolved on render. */
const STABILITY = {
  development: { variant: "secondary", label: "stability.development" },
  alpha: { variant: "warning", label: "stability.alpha" },
  beta: { variant: "info", label: "stability.beta" },
  stable: { variant: "success", label: "stability.stable" },
  deprecated: { variant: "error", label: "stability.deprecated" },
  unmaintained: { variant: "error", label: "stability.unmaintained" },
} as const;

export type Stability = keyof typeof STABILITY;

interface StatusPillProps {
  stability: Stability;
  className?: string;
}

export function StatusPill({ stability, className }: StatusPillProps) {
  const { t } = useTranslation("common");
  const { variant, label } = STABILITY[stability];
  return (
    <GlowBadge variant={variant} className={className}>
      {t(label)}
    </GlowBadge>
  );
}
