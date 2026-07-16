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

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  SITE_ORIGIN,
} from "@/lib/seo/constants";
import { STATIC_ROUTE_META } from "@/lib/seo/derive";

export interface SeoProps {
  /** Page title. Falls back to the static route map, then the site default. */
  title?: string;
  /** Meta/OG description. Falls back to the static route map, then the site default. */
  description?: string;
  /** Absolute social image URL. Defaults to the shared og-default.png. */
  image?: string;
  /**
   * Canonical pathname (without query string). Defaults to the current route's
   * pathname, which is already query-less.
   */
  pathname?: string;
}

/**
 * Upserts a single `<meta>` tag identified by `attr`=`key` (e.g. name="description"
 * or property="og:title"), so we update the static tag from index.html in place
 * rather than appending a duplicate.
 */
function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Upserts the canonical `<link rel="canonical">`. */
function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Per-route document metadata. Renders nothing; imperatively syncs the document
 * title, description, canonical link, and Open Graph / Twitter tags to the
 * resolved values for the current route.
 *
 * This is the client-side layer of SEO metadata (browser tab titles + what a
 * JS-rendering crawler such as Googlebot sees). Non-JS social scrapers are
 * served the same values at the edge; both derive from the shared src/lib/seo
 * helpers so they agree per URL.
 */
export function Seo({ title, description, image, pathname }: SeoProps) {
  const location = useLocation();
  const path = pathname ?? location.pathname;

  const staticMeta = STATIC_ROUTE_META[path];
  const resolvedTitle = title ?? staticMeta?.title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? staticMeta?.description ?? DEFAULT_DESCRIPTION;
  const resolvedImage = image ?? DEFAULT_OG_IMAGE;
  const canonicalUrl = `${SITE_ORIGIN}${path}`;

  useEffect(() => {
    document.title = resolvedTitle;
    upsertMeta("name", "description", resolvedDescription);
    upsertCanonical(canonicalUrl);

    upsertMeta("property", "og:title", resolvedTitle);
    upsertMeta("property", "og:description", resolvedDescription);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", resolvedImage);

    upsertMeta("name", "twitter:title", resolvedTitle);
    upsertMeta("name", "twitter:description", resolvedDescription);
    upsertMeta("name", "twitter:image", resolvedImage);
  }, [resolvedTitle, resolvedDescription, resolvedImage, canonicalUrl]);

  return null;
}
