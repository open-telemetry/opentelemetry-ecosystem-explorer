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
import type { TimelineEvent } from "../types";
import { eventReference, formatDate } from "../utils/timeline-layout";
import { getEventTypeStyle } from "../utils/timeline-colors";
import { isSafeUrl } from "../utils/url";

interface TimelineDetailPanelProps {
  event: TimelineEvent | null;
  locale: string;
}

export function TimelineDetailPanel({ event, locale }: TimelineDetailPanelProps) {
  const { t } = useTranslation("semantic-conventions");

  if (!event) {
    return (
      <div aria-live="polite" className="p-6">
        <p className="text-muted-foreground text-sm">{t("timeline.detail.empty")}</p>
      </div>
    );
  }

  const style = getEventTypeStyle(event.type);

  return (
    <div aria-live="polite" className="grid gap-4 p-6">
      <div>
        <div className="text-foreground text-2xl font-semibold tracking-tight">
          {formatDate(event.date, locale)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">{eventReference(event)}</div>
        <div className="text-muted-foreground mt-1 text-xs">
          {event.dateBasis === "specification-commit"
            ? t("timeline.detail.specCommitDate")
            : t("timeline.detail.releaseDate")}
        </div>
      </div>
      <div>
        <div className={`text-xs font-semibold ${style.textClass}`}>
          {t(`timeline.filters.type.${event.type}`)}
        </div>
        <h3 className="text-foreground mt-1 text-lg font-semibold">{event.title}</h3>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{event.detail}</p>
        {event.type === "baseline" && (
          <p className="text-muted-foreground mt-2 text-sm">{t("timeline.detail.baselineNote")}</p>
        )}
        {event.firstRelease && (
          <p className="text-muted-foreground mt-2 text-sm">
            {t("timeline.detail.firstReleaseNote", { version: event.firstRelease })}
          </p>
        )}
        {event.transition && (
          <p className="text-muted-foreground mt-2 text-sm">{event.transition}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-4">
          {isSafeUrl(event.source) && (
            <a
              href={event.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              {t("timeline.detail.sourceLink")}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {event.lineageSource && isSafeUrl(event.lineageSource) && (
            <a
              href={event.lineageSource}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              {t("timeline.detail.lineageLink")}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
