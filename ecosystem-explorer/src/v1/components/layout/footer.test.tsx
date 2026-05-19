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
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { FooterV1 } from "./footer";
import { ThemeProvider } from "@/theme-context";

function renderFooter() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <FooterV1 />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const expectedLeftLinks = [
  { name: "Mailing Lists", url: "https://github.com/open-telemetry/community#mailing-lists" },
  { name: "Bluesky", url: "https://bsky.app/profile/opentelemetry.io" },
  { name: "Mastodon", url: "https://fosstodon.org/@opentelemetry" },
  { name: "Stack Overflow", url: "https://stackoverflow.com/questions/tagged/open-telemetry" },
  {
    name: "OTel logos",
    url: "https://github.com/cncf/artwork/tree/master/projects/opentelemetry",
  },
  {
    name: "Meeting Recordings",
    url: "https://docs.google.com/spreadsheets/d/1SYKfjYhZdm2Wh2Cl6KVQalKg_m4NhTPZqq-8SzEVO6s",
  },
  { name: "Site analytics", url: "https://lookerstudio.google.com/s/tSTKxK1ECeU" },
];

const expectedRightLinks = [
  { name: "GitHub", url: "https://github.com/open-telemetry" },
  { name: "Slack #opentelemetry", url: "https://cloud-native.slack.com/archives/CJFCJHG4Q" },
  {
    name: "CNCF DevStats",
    url: "https://opentelemetry.devstats.cncf.io/d/8/dashboards?orgId=1&refresh=15m",
  },
  { name: "Privacy Policy", url: "https://www.linuxfoundation.org/legal/privacy-policy" },
  { name: "Trademark Usage", url: "https://www.linuxfoundation.org/legal/trademark-usage" },
  { name: "Marketing Guidelines", url: "/community/marketing-guidelines/" },
  { name: "Site-build info", url: "/site/" },
];

describe("FooterV1", () => {
  it("renders all 7 user (left-cluster) links with the correct hrefs and aria-labels", () => {
    renderFooter();

    for (const link of expectedLeftLinks) {
      const a = screen.getByRole("link", { name: link.name });
      expect(a).toHaveAttribute("href", link.url);
      expect(a).toHaveAttribute("title", link.name);
    }
  });

  it("renders all 7 developer (right-cluster) links with the correct hrefs and aria-labels", () => {
    renderFooter();

    for (const link of expectedRightLinks) {
      const a = screen.getByRole("link", { name: link.name });
      expect(a).toHaveAttribute("href", link.url);
      expect(a).toHaveAttribute("title", link.name);
    }
  });

  it("marks external links with target=_blank and rel=noopener noreferrer", () => {
    renderFooter();

    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("target", "_blank");
    const rel = github.getAttribute("rel") ?? "";
    expect(rel).toMatch(/\bnoopener\b/);
    expect(rel).toMatch(/\bnoreferrer\b/);
  });

  it("does not open internal links in a new tab", () => {
    renderFooter();

    const internal = screen.getByRole("link", { name: "Marketing Guidelines" });
    expect(internal).not.toHaveAttribute("target");
  });

  it('preserves rel="me" on the Mastodon link alongside noopener noreferrer', () => {
    renderFooter();

    const mastodon = screen.getByRole("link", { name: "Mastodon" });
    const rel = mastodon.getAttribute("rel") ?? "";
    expect(rel).toMatch(/\bme\b/);
    expect(rel).toMatch(/\bnoopener\b/);
    expect(rel).toMatch(/\bnoreferrer\b/);
  });

  it("renders the copyright with the CC BY 4.0 link", () => {
    renderFooter();

    const ccLink = screen.getByRole("link", { name: /CC BY 4\.0/i });
    expect(ccLink).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0");
    expect(ccLink).toHaveAttribute("target", "_blank");
  });

  it("renders the copyright text with the year span and authors", () => {
    renderFooter();

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText(/2019.*present/)).toBeInTheDocument();
    expect(within(footer).getByText(/OpenTelemetry Authors/)).toBeInTheDocument();
  });
});
