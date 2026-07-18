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
 * FooterV1 — mirrors opentelemetry.io's `.td-footer` chrome verbatim.
 *
 * Source rules (in the local opentelemetry.io clone):
 *   themes/docsy/layouts/_partials/footer.html        — three-column layout
 *   themes/docsy/layouts/_partials/footer/{left,right,center,links,copyright}.html
 *   themes/docsy/assets/scss/td/_footer.scss          — dark surface + spacing
 *   config/_default/hugo.yaml                         — link inventory + copyright
 *
 * Link inventory is locked against the upstream YAML (7 user + 7 developer).
 * Icons follow the locked decision (foundation-audit Q3, 2026-05-06): inline
 * SVG for brand marks Lucide doesn't ship; Lucide for everything else.
 */

import { AreaChart, Book, Hammer, Image, LineChart, Mail, Megaphone, Video } from "lucide-react";
import { BlueskyIcon } from "@/v1/components/icons/bluesky-icon";
import { GitHubIcon } from "@/v1/components/icons/github-icon";
import { MastodonIcon } from "@/v1/components/icons/mastodon-icon";
import { SlackIcon } from "@/v1/components/icons/slack-icon";
import { StackOverflowIcon } from "@/v1/components/icons/stack-overflow-icon";
import { TrademarkIcon } from "@/v1/components/icons/trademark-icon";

type FooterLink = {
  name: string;
  url: string;
  icon: React.ReactNode;
  rel?: string;
};

const userLinks: FooterLink[] = [
  {
    name: "Mailing Lists",
    url: "https://github.com/open-telemetry/community#mailing-lists",
    icon: <Mail className="td-footer__icon" aria-hidden />,
  },
  {
    name: "Bluesky",
    url: "https://bsky.app/profile/opentelemetry.io",
    icon: <BlueskyIcon className="td-footer__icon" />,
  },
  {
    name: "Mastodon",
    url: "https://fosstodon.org/@opentelemetry",
    icon: <MastodonIcon className="td-footer__icon" />,
    rel: "me",
  },
  {
    name: "Stack Overflow",
    url: "https://stackoverflow.com/questions/tagged/open-telemetry",
    icon: <StackOverflowIcon className="td-footer__icon" />,
  },
  {
    name: "OTel logos",
    url: "https://github.com/cncf/artwork/tree/master/projects/opentelemetry",
    icon: <Image className="td-footer__icon" aria-hidden />,
  },
  {
    name: "Meeting Recordings",
    url: "https://docs.google.com/spreadsheets/d/1SYKfjYhZdm2Wh2Cl6KVQalKg_m4NhTPZqq-8SzEVO6s",
    icon: <Video className="td-footer__icon" aria-hidden />,
  },
  {
    name: "Site analytics",
    url: "https://lookerstudio.google.com/s/tSTKxK1ECeU",
    icon: <LineChart className="td-footer__icon" aria-hidden />,
  },
];

const developerLinks: FooterLink[] = [
  {
    name: "GitHub",
    url: "https://github.com/open-telemetry",
    icon: <GitHubIcon className="td-footer__icon" />,
  },
  {
    name: "Slack #opentelemetry",
    url: "https://cloud-native.slack.com/archives/CJFCJHG4Q",
    icon: <SlackIcon className="td-footer__icon" />,
  },
  {
    name: "CNCF DevStats",
    url: "https://opentelemetry.devstats.cncf.io/d/8/dashboards?orgId=1&refresh=15m",
    icon: <AreaChart className="td-footer__icon" aria-hidden />,
  },
  {
    name: "Privacy Policy",
    url: "https://www.linuxfoundation.org/legal/privacy-policy",
    icon: <Book className="td-footer__icon" aria-hidden />,
  },
  {
    name: "Trademark Usage",
    url: "https://www.linuxfoundation.org/legal/trademark-usage",
    icon: <TrademarkIcon className="td-footer__icon" />,
  },
  {
    name: "Marketing Guidelines",
    url: "/community/marketing-guidelines/",
    icon: <Megaphone className="td-footer__icon" aria-hidden />,
  },
  {
    name: "Site-build info",
    url: "/site/",
    icon: <Hammer className="td-footer__icon" aria-hidden />,
  },
];

const EXTERNAL_URL = /^https?:\/\//;

function FooterLinks({ items }: { items: FooterLink[] }) {
  return (
    <ul className="td-footer__links-list">
      {items.map((link) => {
        const isExternal = EXTERNAL_URL.test(link.url);
        const rel = [link.rel, isExternal ? "noopener noreferrer" : undefined]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={link.name} className="td-footer__links-item">
            <a
              href={link.url}
              title={link.name}
              aria-label={link.name}
              target={isExternal ? "_blank" : undefined}
              rel={rel || undefined}
            >
              {link.icon}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function FooterV1() {
  return (
    <footer className="td-footer">
      <div className="td-footer__container">
        <div className="td-footer__row">
          <div className="td-footer__left">
            <FooterLinks items={userLinks} />
          </div>
          <div className="td-footer__right">
            <FooterLinks items={developerLinks} />
          </div>
          <div className="td-footer__center">
            <span className="td-footer__copyright">
              &copy; 2019&ndash;present{" "}
              <span className="td-footer__authors">
                OpenTelemetry Authors | Docs{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CC BY 4.0
                </a>
              </span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
