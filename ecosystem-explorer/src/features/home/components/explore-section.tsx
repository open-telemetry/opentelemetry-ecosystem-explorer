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
import { JavaIcon } from "@/components/icons/java-icon";
import { PipelineIcon } from "@/components/icons/pipeline-icon";
import { SemanticConventionsIcon } from "@/components/icons/semantic-conventions-icon";
import { NavigationCard } from "@/components/ui/navigation-card";

export function ExploreSection() {
  const { t } = useTranslation("home");
  return (
    <section className="bg-background relative px-6" aria-labelledby="explore-heading">
      {/* Subtle ambient glow at top */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-64 w-full max-w-3xl -translate-x-1/2 -translate-y-16"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--otel-blue-hsl) / 0.04) 0%, transparent 80%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden="true" className="bg-primary h-0.5 w-6" />
          <h2 id="explore-heading" className="text-foreground text-lg font-semibold">
            {t("explore.heading")}
          </h2>
        </div>

        {/* Navigation cards */}
        <div className="grid gap-6 lg:grid-cols-3 lg:grid-rows-2">
          <div className="lg:col-span-2 lg:row-span-2">
            <NavigationCard
              title={t("explore.javaAgent.title")}
              description={t("explore.javaAgent.description")}
              href="/java-agent"
              icon={<JavaIcon className="h-14 w-14" />}
              variant="featured"
            />
          </div>
          <NavigationCard
            title={t("explore.collector.title")}
            description={t("explore.collector.description")}
            href="/collector"
            icon={<PipelineIcon className="h-8 w-8" />}
            variant="compact"
          />
          <NavigationCard
            title={t("explore.semanticConventions.title")}
            description={t("explore.semanticConventions.description")}
            href="/semantic-conventions"
            icon={<SemanticConventionsIcon className="h-8 w-8" />}
            variant="compact"
          />
        </div>
      </div>
    </section>
  );
}
