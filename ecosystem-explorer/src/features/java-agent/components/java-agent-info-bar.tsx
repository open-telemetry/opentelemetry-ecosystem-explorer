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

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Tag, AlertCircle } from "lucide-react";
import { useJavaAgentSummary } from "../hooks/use-java-agent-summary";

export function JavaAgentInfoBar() {
  const { t, i18n } = useTranslation("java-agent");
  const { data, loading, error } = useJavaAgentSummary();
  const latestVersion = data?.latestVersion ?? null;
  const instrumentationCount = data?.instrumentationCount ?? null;

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language),
    [i18n.resolvedLanguage, i18n.language]
  );

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-600 dark:text-red-400"
      >
        <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">
          {t("explore.infoBar.error", { message: error.message })}
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border-border/60 bg-card/40 grid grid-cols-1 gap-4 rounded-xl border p-4 backdrop-blur-sm sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-10 w-10 animate-pulse rounded-lg" />
          <div className="space-y-2">
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="bg-muted h-3 w-20 animate-pulse rounded" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-muted h-10 w-10 animate-pulse rounded-lg" />
          <div className="space-y-2">
            <div className="bg-muted h-4 w-28 animate-pulse rounded" />
            <div className="bg-muted h-3 w-16 animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  const formattedCount =
    instrumentationCount !== null ? numberFormatter.format(instrumentationCount) : "0";

  return (
    <div className="border-border/60 bg-card/40 grid grid-cols-1 gap-4 rounded-xl border p-4 backdrop-blur-sm sm:grid-cols-2">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
          <Layers className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-foreground text-lg leading-tight font-semibold">{formattedCount}</p>
          <p className="text-muted-foreground text-xs font-medium">
            {t("explore.infoBar.instrumentationCount", {
              count: instrumentationCount ?? 0,
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
          <Tag className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-foreground text-lg leading-tight font-semibold">
            {latestVersion ? `v${latestVersion}` : "—"}
          </p>
          <p className="text-muted-foreground text-xs font-medium">
            {t("explore.infoBar.latestRelease")}
          </p>
        </div>
      </div>
    </div>
  );
}
