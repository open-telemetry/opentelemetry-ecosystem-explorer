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

import type { Context } from "@netlify/edge-functions";

const notFound = () => new Response("Not Found", { status: 404 });

// Rewrites to a static asset and normalizes its Content-Type. Returns null when
// the rewrite resolves to the SPA HTML shell (the catch-all redirect serves
// /index.html with status 200 for unknown paths), so the caller can 404.
// Any non-200 status is returned untouched: a 304 from a conditional
// (If-None-Match) request must stay a 304 — collapsing it to 404 is what broke
// data loading on revalidation. The same applies to 3xx, 206, and real errors.
async function serveAsset(
  context: Context,
  path: string,
  contentType: string,
  extraHeaders?: Record<string, string>
): Promise<Response | null> {
  const response = await context.rewrite(path);
  if (response.status !== 200) {
    return response;
  }

  const originContentType = response.headers.get("content-type") ?? "";
  if (originContentType.includes("text/html")) {
    return null;
  }

  response.headers.set("Content-Type", contentType);
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    response.headers.set(key, value);
  }
  return response;
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const { pathname } = url;
  const acceptHeader = request.headers.get("accept") || "";
  const isMarkdownRequested = acceptHeader.includes("text/markdown");

  // Documentation root files
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    return (
      (await serveAsset(context, pathname, "text/plain; charset=UTF-8", { Vary: "Accept" })) ??
      notFound()
    );
  }

  // Content negotiation for AI agents
  if (isMarkdownRequested) {
    let mdPath = "";
    if (pathname === "/" || pathname === "/index.html") {
      mdPath = "/llms.txt";
    } else if (
      pathname === "/java-agent" ||
      pathname.startsWith("/java-agent/") ||
      pathname === "/javaagent" ||
      pathname.startsWith("/javaagent/")
    ) {
      mdPath = "/agent/javaagent/index.md";
    } else if (pathname === "/collector" || pathname.startsWith("/collector/")) {
      mdPath = "/agent/collector/index.md";
    }

    if (mdPath) {
      const finalContentType = mdPath.endsWith(".md")
        ? "text/markdown; charset=UTF-8"
        : "text/plain; charset=UTF-8";
      const response = await serveAsset(context, mdPath, finalContentType, { Vary: "Accept" });
      if (response) {
        return response;
      }
    }
    // Strict 404 for unrecognized Markdown requests (Copilot feedback)
    return notFound();
  }

  // Explicit agent documentation routes
  const agentPathMap: Record<string, string> = {
    "/agent/collector": "/agent/collector/index.md",
    "/agent/collector/": "/agent/collector/index.md",
    "/agent/collector/versions": "/agent/collector/versions.md",
    "/agent/collector/versions/": "/agent/collector/versions.md",
    "/agent/javaagent": "/agent/javaagent/index.md",
    "/agent/javaagent/": "/agent/javaagent/index.md",
    "/agent/javaagent/versions": "/agent/javaagent/versions.md",
    "/agent/javaagent/versions/": "/agent/javaagent/versions.md",
  };

  const resolvedPath = agentPathMap[pathname] || pathname;
  if (resolvedPath.endsWith(".md") || resolvedPath.startsWith("/agent/")) {
    if (resolvedPath.endsWith(".md")) {
      const response = await serveAsset(context, resolvedPath, "text/markdown; charset=UTF-8");
      if (response) {
        return response;
      }
    }
    return notFound();
  }

  // JSON schemas and metadata
  if (pathname.startsWith("/schemas/") || pathname.startsWith("/data/")) {
    const finalContentType = pathname.endsWith(".json") ? "application/json" : "text/plain";
    return (await serveAsset(context, pathname, finalContentType)) ?? notFound();
  }

  // Sitemap and Robots
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    const finalContentType = pathname.endsWith(".xml") ? "application/xml" : "text/plain";
    return (await serveAsset(context, pathname, finalContentType)) ?? notFound();
  }

  return undefined;
};
