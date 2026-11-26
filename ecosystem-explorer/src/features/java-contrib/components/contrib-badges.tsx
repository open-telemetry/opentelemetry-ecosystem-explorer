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
import { GlowBadge } from "@/components/ui/glow-badge";
import type { ComponentType, ContribDistribution } from "@/types/java-contrib";

const TYPE_VARIANT = {
  library: "info",
  "agent-extension": "accent",
  standalone: "secondary",
} as const satisfies Record<ComponentType, string>;

export function ComponentTypeBadges({ types }: { types: ComponentType[] }) {
  const { t } = useTranslation("java-agent");
  return (
    <>
      {types.map((type) => (
        <GlowBadge key={type} variant={TYPE_VARIANT[type]}>
          {t(`contrib.componentType.${type}`)}
        </GlowBadge>
      ))}
    </>
  );
}

export function DistributionBadges({ distributions }: { distributions: ContribDistribution[] }) {
  const { t } = useTranslation("java-agent");
  return (
    <>
      {distributions.map((d) => (
        <GlowBadge key={d.name} variant="success">
          {t(`contrib.distribution.${d.name}.badge`)}
        </GlowBadge>
      ))}
    </>
  );
}

export function JavaVersionBadge({ version }: { version: number }) {
  const { t } = useTranslation("java-agent");
  if (!version) return null;
  return <GlowBadge variant="muted">{t("contrib.minJava", { version })}</GlowBadge>;
}
