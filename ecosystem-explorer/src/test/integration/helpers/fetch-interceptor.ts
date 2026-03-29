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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolves to ecosystem-explorer/public/
// helpers/ (1) → integration/ (2) → test/ (3) → src/ (4) → ecosystem-explorer/ then /public
const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");

let originalFetch: typeof globalThis.fetch | undefined;

/**
 * Installs a fetch interceptor that serves requests for `/data/*` paths
 * directly from the filesystem (`public/` directory) rather than making
 * real network calls. Any URL that does not start with `/data/` throws so
 * accidental network calls are caught immediately.
 *
 * Call `uninstallFetchInterceptor()` in afterAll/afterEach to restore the
 * original fetch.
 */
export function installFetchInterceptor() {
  originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);

    if (!url.startsWith("/data/")) {
      throw new Error(
        `[fetch-interceptor] Unexpected network call to "${url}". ` +
          "Integration tests should only fetch from /data/. " +
          "If this is intentional, update the interceptor."
      );
    }

    const filePath = path.join(PUBLIC_DIR, url);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(null, {
        status: 404,
        statusText: "Not Found",
      });
    }
  };
}

/**
 * Restores the original `globalThis.fetch` saved by `installFetchInterceptor`.
 */
export function uninstallFetchInterceptor() {
  if (originalFetch !== undefined) {
    globalThis.fetch = originalFetch;
    originalFetch = undefined;
  }
}
