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

import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SemanticConventionsIcon } from "@/components/icons/semantic-conventions-icon";
import { NavigationCard } from "@/components/ui/navigation-card";

const SPEC_SITE_URL = "https://opentelemetry.io/docs/specs/semconv/";

export function SemanticConventionsLanding() {
  const { t } = useTranslation("semantic-conventions");

  return (
    <section className="bg-background relative px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="grid gap-4 md:grid-cols-2">
          <NavigationCard
            title={t("landing.timelineCard.title")}
            description={t("landing.timelineCard.description")}
            href="/semantic-conventions/timeline"
            icon={<SemanticConventionsIcon className="h-20 w-20" />}
          />
        </div>

        <section aria-labelledby="semantic-conventions-resources" className="space-y-4">
          <div>
            <h2 id="semantic-conventions-resources" className="text-foreground text-2xl font-bold">
              {t("landing.resources.heading")}
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <a
              href={SPEC_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border/60 bg-card/80 hover:border-primary/40 hover:bg-card focus-visible:ring-primary group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="text-foreground font-medium">
                {t("landing.resources.items.specSite")}
              </span>
              <ExternalLink
                className="text-muted-foreground group-hover:text-primary h-4 w-4 flex-shrink-0"
                aria-hidden="true"
              />
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
