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

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const { pathname } = url;
  const acceptHeader = request.headers.get("accept") || "";
  const isMarkdownRequested = acceptHeader.includes("text/markdown");

  // Documentation root files
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    const response = await context.rewrite(pathname);
    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        return new Response("Not Found", { status: 404 });
      }
      response.headers.set("Content-Type", "text/plain; charset=UTF-8");
      response.headers.set("Vary", "Accept");
      return response;
    }
    return new Response("Not Found", { status: 404 });
  }

  // Content negotiation for AI agents
  if (isMarkdownRequested) {
    let mdPath = "";
    if (pathname === "/" || pathname === "/index.html") {
      mdPath = "/llms.txt";
    } else if (pathname.startsWith("/java-agent")) {
      mdPath = "/agent/javaagent/index.md";
    } else if (pathname.startsWith("/collector")) {
      mdPath = "/agent/collector/index.md";
    }

    if (mdPath) {
      const response = await context.rewrite(mdPath);
      if (response.status === 200) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          return new Response("Not Found", { status: 404 });
        }
        const finalContentType = mdPath.endsWith(".md")
          ? "text/markdown; charset=UTF-8"
          : "text/plain; charset=UTF-8";
        response.headers.set("Content-Type", finalContentType);
        response.headers.set("Vary", "Accept");
        return response;
      }
    }
    // Strict 404 for unrecognized Markdown requests (Copilot feedback)
    return new Response("Not Found", { status: 404 });
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
      const response = await context.rewrite(resolvedPath);
      if (response.status === 200) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          return new Response("Not Found", { status: 404 });
        }
        response.headers.set("Content-Type", "text/markdown; charset=UTF-8");
        return response;
      }
    }
    return new Response("Not Found", { status: 404 });
  }

  // JSON schemas and metadata
  if (pathname.startsWith("/schemas/") || pathname.startsWith("/data/")) {
    const response = await context.rewrite(pathname);
    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        return new Response("Not Found", { status: 404 });
      }
      const finalContentType = pathname.endsWith(".json") ? "application/json" : "text/plain";
      response.headers.set("Content-Type", finalContentType);
      return response;
    }
    return new Response("Not Found", { status: 404 });
  }

  // Sitemap and Robots
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    const response = await context.rewrite(pathname);
    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        return new Response("Not Found", { status: 404 });
      }
      const finalContentType = pathname.endsWith(".xml") ? "application/xml" : "text/plain";
      response.headers.set("Content-Type", finalContentType);
      return response;
    }
    return new Response("Not Found", { status: 404 });
  }

  return undefined;
};
