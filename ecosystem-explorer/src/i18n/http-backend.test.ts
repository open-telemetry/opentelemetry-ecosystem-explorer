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
import { describe, it, expect, vi, afterEach } from "vitest";
import type { CallbackError, ResourceKey } from "i18next";
import { httpBackend } from "@/i18n/http-backend";

/** Resolves with whatever read() passes to the i18next callback. */
function read(
  language: string,
  namespace: string
): Promise<{ error: CallbackError; data: ResourceKey | boolean | null | undefined }> {
  return new Promise((resolve) => {
    httpBackend.read(language, namespace, (error, data) => resolve({ error, data }));
  });
}

function mockFetch(response: Partial<Response> | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response)
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpBackend", () => {
  it("fetches the locale file for a language/namespace pair and returns parsed JSON", async () => {
    const translations = { "nav.home": "Home" };
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve(translations),
    });

    const { error, data } = await read("es", "java-agent");

    expect(fetchMock).toHaveBeenCalledWith("/locales/es/java-agent.json");
    expect(error).toBeNull();
    expect(data).toEqual(translations);
  });

  it("percent-encodes the language so a traversal attempt cannot escape /locales", async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) });

    await read("../../etc/passwd", "common");

    expect(fetchMock).toHaveBeenCalledWith("/locales/..%2F..%2Fetc%2Fpasswd/common.json");
  });

  it("percent-encodes the namespace too, so neither URL segment can be traversed", async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) });

    await read("en", "../../etc/passwd");

    expect(fetchMock).toHaveBeenCalledWith("/locales/en/..%2F..%2Fetc%2Fpasswd.json");
  });

  it("does not ask i18next to retry a 404 - the file is genuinely absent", async () => {
    mockFetch({ ok: false, status: 404 });

    const { error, data } = await read("en", "common");

    expect(error).toBeInstanceOf(Error);
    expect(data).toBe(false);
  });

  it("asks i18next to retry a 5xx", async () => {
    mockFetch({ ok: false, status: 503 });

    const { error, data } = await read("en", "common");

    expect(error).toBeInstanceOf(Error);
    expect(data).toBe(true);
  });

  it("asks i18next to retry when the request itself fails", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    const { error, data } = await read("en", "common");

    expect(error).toBeInstanceOf(TypeError);
    expect(data).toBe(true);
  });

  it("does not retry malformed JSON - a second fetch would return the same bytes", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });

    const { error, data } = await read("en", "common");

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("failed parsing");
    expect(data).toBe(false);
  });
});
