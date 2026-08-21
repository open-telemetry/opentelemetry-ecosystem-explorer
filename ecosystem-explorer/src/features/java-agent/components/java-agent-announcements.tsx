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
import { useJavaAgentAnnouncements } from "../hooks/use-java-agent-announcements";
import { ExternalLink, Calendar } from "lucide-react";
import { isSafeUrl } from "../utils/url";

const MIN_ANNOUNCEMENT_SKELETON_COUNT = 3;

function AnnouncementCardSkeleton() {
  return (
    <div
      className="border-border/60 bg-card/80 rounded-lg border p-5 shadow-sm"
      data-testid="announcement-skeleton-card"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="bg-muted h-4 w-4 animate-pulse rounded" />
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-5 w-4/5 animate-pulse rounded" />
        <div className="space-y-2">
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-11/12 animate-pulse rounded" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
        </div>
      </div>
      <div className="border-border/40 mt-4 border-t pt-4">
        <div className="bg-muted h-4 w-20 animate-pulse rounded" />
      </div>
    </div>
  );
}

export function JavaAgentAnnouncements() {
  const { t } = useTranslation("java-agent");
  const { data: announcements, loading, error } = useJavaAgentAnnouncements();
  const skeletonCount = Math.max(MIN_ANNOUNCEMENT_SKELETON_COUNT, announcements?.length ?? 0);

  if (loading) {
    return (
      <section
        aria-labelledby="java-agent-announcements"
        aria-busy="true"
        className="space-y-4"
      >
        <div>
          <h2 id="java-agent-announcements" className="text-foreground text-2xl font-bold">
            {t("explore.announcements.heading")}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <AnnouncementCardSkeleton key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (error || !announcements || announcements.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="java-agent-announcements" className="space-y-4">
      <div>
        <h2 id="java-agent-announcements" className="text-foreground text-2xl font-bold">
          {t("explore.announcements.heading")}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="border-border/60 bg-card/80 flex flex-col justify-between rounded-lg border p-5 shadow-sm"
          >
            <div className="space-y-3">
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <time dateTime={announcement.date}>{announcement.date}</time>
              </div>
              <h3 className="text-foreground text-lg leading-tight font-semibold">
                {announcement.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{announcement.body}</p>
            </div>
            {announcement.link && isSafeUrl(announcement.link) && (
              <div className="border-border/40 mt-4 border-t pt-4">
                <a
                  href={announcement.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                >
                  {t("explore.announcements.readMore")}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
