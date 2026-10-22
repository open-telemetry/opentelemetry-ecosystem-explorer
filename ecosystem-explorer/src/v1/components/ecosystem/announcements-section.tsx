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
 * AnnouncementsSection — optional "News & Announcements" band on an ecosystem
 * landing, right below the hero. Items come from the Java Agent announcements
 * feed (`useJavaAgentAnnouncements`), whose path is fixed, so only ecosystems
 * that opt in through `EcosystemConfig.announcements` render it.
 *
 * The section is optional content, so it never reports failure: while the fetch
 * is fast, and when it fails or returns nothing, it renders nothing and the page
 * is laid out as if it did not exist. Only a request still outstanding after
 * `SKELETON_DELAY_MS` reserves space with a skeleton card.
 */

import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useJavaAgentAnnouncements } from "@/features/java-agent/hooks/use-java-agent-announcements";
import { isSafeUrl } from "@/features/java-agent/utils/url";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";

/** A static JSON file normally resolves inside this, so the common path never flashes a skeleton. */
const SKELETON_DELAY_MS = 300;

export interface AnnouncementsSectionProps {
  /** Resolved section heading. */
  heading: string;
  /** Resolved screen-reader text announced while the skeleton is shown. */
  loadingLabel: string;
  /** Resolved label of each card's link. */
  readMoreLabel: string;
}

/** Formats an ISO date for the active language, falling back to the raw value if it is not a date. */
function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  // Date-only strings parse as UTC midnight; format in UTC so the day cannot shift with the viewer's zone.
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export function AnnouncementsSection({
  heading,
  loadingLabel,
  readMoreLabel,
}: AnnouncementsSectionProps) {
  const { t, i18n } = useTranslation("ecosystem");
  const { data, loading } = useJavaAgentAnnouncements();
  const showSkeleton = useDelayedFlag(loading, SKELETON_DELAY_MS);

  const announcements = data ?? [];
  if (loading ? !showSkeleton : announcements.length === 0) {
    return null;
  }

  const locale = i18n.resolvedLanguage || i18n.language;

  return (
    <section
      className="td-box td-box--muted"
      aria-labelledby="announcements-title"
      aria-busy={loading || undefined}
    >
      <div className="td-box__container">
        <h2 id="announcements-title" className="td-announcements__title">
          {heading}
        </h2>
        {loading && (
          <p role="status" aria-live="polite" className="sr-only">
            {loadingLabel}
          </p>
        )}
        <div className="td-announcements__grid">
          {loading ? (
            <div className="td-home__skeleton" style={{ height: "9rem" }} aria-hidden />
          ) : (
            announcements.map((announcement) => (
              <article key={announcement.id} className="td-announcements__card">
                <time className="td-announcements__date" dateTime={announcement.date}>
                  {formatDate(announcement.date, locale)}
                </time>
                <h3 className="td-announcements__card-title">{announcement.title}</h3>
                <p className="td-announcements__body">{announcement.body}</p>
                {announcement.link && isSafeUrl(announcement.link) && (
                  <a
                    href={announcement.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="td-announcements__link"
                  >
                    {readMoreLabel}
                    <span className="sr-only">
                      {`: ${announcement.title} ${t("quickEntry.opensInNewTab")}`}
                    </span>
                    <ExternalLink
                      className="td-announcements__link-icon"
                      aria-hidden
                      focusable="false"
                    />
                  </a>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
