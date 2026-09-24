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

import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { useSemanticConventionsTimeline } from "./hooks/use-semantic-conventions-timeline";
import { SemanticConventionTimeline } from "./components/semantic-convention-timeline";

function TimelineSkeleton() {
  return (
    <div className="border-border/60 bg-card/40 space-y-4 rounded-xl border p-6">
      <div className="bg-muted h-8 w-2/3 animate-pulse rounded" />
      <div className="bg-muted h-64 w-full animate-pulse rounded" />
    </div>
  );
}

export function SemanticConventionsTimelinePage() {
  const { t } = useTranslation("semantic-conventions");
  const { data, loading, error } = useSemanticConventionsTimeline();

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-6">
        <BackButton />
        <div>
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            {t("timeline.page.eyebrow")}
          </p>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <span className="text-gradient-brand">{t("timeline.page.title")}</span>
          </h1>
          <p className="text-muted-foreground">{t("timeline.page.description")}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">
              {t("timeline.page.loadError", { message: error.message })}
            </span>
          </div>
        )}

        {loading && <TimelineSkeleton />}

        {data && <SemanticConventionTimeline data={data} />}
      </div>
    </PageContainer>
  );
}
