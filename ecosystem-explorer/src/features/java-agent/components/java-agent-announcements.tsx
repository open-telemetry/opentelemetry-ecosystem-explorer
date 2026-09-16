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

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useJavaAgentAnnouncements } from "../hooks/use-java-agent-announcements";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";
import { ExternalLink, Calendar } from "lucide-react";
import { isSafeUrl } from "../utils/url";

/*
 * Reserve exactly one card. The skeleton only reduces layout shift while it matches the
 * number of cards that actually arrive — reserving a full row collapses hard when fewer
 * (or no) announcements come back. Raise this only alongside a guaranteed minimum.
 */
const ANNOUNCEMENT_SKELETON_COUNT = 1;

/*
 * Hold the skeleton back until the fetch has been outstanding this long. A static JSON file
 * usually resolves well inside the threshold, so the common path paints the real cards once
 * and never flashes a placeholder; only a genuinely slow response reserves space.
 */
const SKELETON_DELAY_MS = 300;

/*
 * Cap the column count at the number of cards, so a short row fills the container instead of
 * leaving dead space to the right of a lone card. Classes are spelled out rather than built by
 * interpolation, since Tailwind only emits what it can find literally in the source.
 */
function gridColumnsClass(count: number): string {
  if (count <= 1) {
    return "grid-cols-1";
  }
  if (count === 2) {
    return "grid-cols-1 md:grid-cols-2";
  }
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}

/** Section chrome shared by the loading and loaded states so the reserved layout can't drift. */
function AnnouncementsSection({
  count,
  loading,
  children,
}: {
  count: number;
  loading?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("java-agent");

  return (
    <section
      aria-labelledby="java-agent-announcements"
      aria-busy={loading ? true : undefined}
      className="space-y-4"
    >
      <div>
        <h2 id="java-agent-announcements" className="text-foreground text-2xl font-bold">
          {t("explore.announcements.heading")}
        </h2>
      </div>
      {loading && (
        <p role="status" aria-live="polite" className="sr-only">
          {t("explore.announcements.loading")}
        </p>
      )}
      <div className={`grid gap-4 ${gridColumnsClass(count)}`} data-testid="announcements-grid">
        {children}
      </div>
    </section>
  );
}

function AnnouncementCardSkeleton() {
  return (
    <div
      className="border-border/60 bg-card/80 rounded-lg border p-5 shadow-sm"
      data-testid="announcement-skeleton-card"
      aria-hidden="true"
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
  const showSkeleton = useDelayedFlag(loading, SKELETON_DELAY_MS);

  if (loading) {
    if (!showSkeleton) {
      return null;
    }
    return (
      <AnnouncementsSection count={ANNOUNCEMENT_SKELETON_COUNT} loading>
        {Array.from({ length: ANNOUNCEMENT_SKELETON_COUNT }).map((_, index) => (
          <AnnouncementCardSkeleton key={index} />
        ))}
      </AnnouncementsSection>
    );
  }

  if (error || !announcements || announcements.length === 0) {
    return null;
  }

  return (
    <AnnouncementsSection count={announcements.length}>
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
    </AnnouncementsSection>
  );
}
