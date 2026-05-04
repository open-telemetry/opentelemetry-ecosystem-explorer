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

  // 1. Handle root documentation files
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
    const response = await context.rewrite(pathname);
    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        return new Response("Not Found", { status: 404 });
      }
      response.headers.set("Content-Type", "text/plain");
      return response;
    }
    return new Response("Not Found", { status: 404 });
  }

  // 2. Handle Sitemap and Robots
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    const response = await context.rewrite(pathname);
    if (response.status === 200) {
      const contentType = pathname.endsWith(".xml") ? "application/xml" : "text/plain";
      response.headers.set("Content-Type", contentType);
      return response;
    }
  }

  // 3. Handle JSON schemas
  if (pathname.startsWith("/schemas/")) {
    if (
      pathname === "/schemas/collector-component.schema.json" ||
      pathname === "/schemas/javaagent-instrumentation.schema.json"
    ) {
      const response = await context.rewrite(pathname);
      if (response.status === 200) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          return new Response("Not Found", { status: 404 });
        }
        response.headers.set("Content-Type", "application/json");
        return response;
      }
    }
    return new Response("Not Found", { status: 404 });
  }

  // 4. Handle agent documentation routes
  let mdPath = pathname;
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

  if (agentPathMap[mdPath]) {
    mdPath = agentPathMap[mdPath];
  }

  if (mdPath.endsWith(".md")) {
    const response = await context.rewrite(mdPath);
    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        return new Response("Not Found", { status: 404 });
      }
      response.headers.set("Content-Type", "text/markdown");
      return response;
    }
  }

  // 5. Fallback for any other /agent/ path to avoid soft 404s
  if (pathname.startsWith("/agent/")) {
    return new Response("Not Found", { status: 404 });
  }
};
