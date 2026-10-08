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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConfigEnv, UserConfig } from "vite";
import { dataContentId, dataContentIdPlugin } from "./data-content-id";

const FIXTURE_ID = "408da849e724ebe49ec90ca5f387b14fa582d204c84269fd58ca3af350d1e3cf";
const EMPTY_ID = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const LEADING_DASH_ID = "6de2ec0ef81000cc101a8f0295451a64854f8f64af8b1b70515bc1d843fab007";
const SENTINELS = [
  "javaagent/versions-index.json",
  "collector/versions-index.json",
  "configuration/versions-index.json",
  "javascript/index.json",
];

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "data-content-id-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeFixture(dir: string): void {
  mkdirSync(path.join(dir, "sub"), { recursive: true });
  mkdirSync(path.join(dir, "Z"), { recursive: true });
  writeFileSync(path.join(dir, "a.json"), '{"a":1}\n');
  writeFileSync(path.join(dir, "sub", "b.md"), "# b\n");
  writeFileSync(path.join(dir, "Z", "c.txt"), "upper\n");
  symlinkSync("a.json", path.join(dir, "link.json"));
  symlinkSync("sub", path.join(dir, "linked-dir"));
}

function writeGenerated(dir: string): void {
  for (const sentinel of SENTINELS) {
    mkdirSync(path.dirname(path.join(dir, sentinel)), { recursive: true });
    writeFileSync(path.join(dir, sentinel), "{}\n");
  }
}

function runConfig(dir: string, command: ConfigEnv["command"]): UserConfig {
  const hook = dataContentIdPlugin(dir).config;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  return handler?.call({} as never, {}, { command, mode: command }) as UserConfig;
}

describe("dataContentId", () => {
  it("matches content-digest.sh on a tree with symlinks and mixed case", () => {
    writeFixture(dataDir);
    expect(dataContentId(dataDir)).toBe(FIXTURE_ID);
  });

  it("matches content-digest.sh on an empty directory", () => {
    expect(dataContentId(dataDir)).toBe(EMPTY_ID);
  });

  it("matches content-digest.sh on a name starting with a dash", () => {
    writeFileSync(path.join(dataDir, "-x.json"), "{}\n");
    expect(dataContentId(dataDir)).toBe(LEADING_DASH_ID);
  });

  it.each(["back\\slash.json", "carriage\rreturn.json", "new\nline.json"])(
    "rejects %j, which sha256sum would escape",
    (name) => {
      writeFileSync(path.join(dataDir, name), "{}");
      expect(() => dataContentId(dataDir)).toThrow(/sha256sum/);
    }
  );
});

describe("dataContentIdPlugin", () => {
  it("defines import.meta.env.DATA_CONTENT_ID as a JSON string", () => {
    writeGenerated(dataDir);
    expect(runConfig(dataDir, "build").define).toEqual({
      "import.meta.env.DATA_CONTENT_ID": JSON.stringify(dataContentId(dataDir)),
    });
  });

  it.each(SENTINELS)("fails a build when %s is missing", (sentinel) => {
    writeGenerated(dataDir);
    rmSync(path.join(dataDir, sentinel));
    expect(() => runConfig(dataDir, "build")).toThrow(sentinel);
  });

  it("only warns on the dev server", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = runConfig(dataDir, "serve");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/javaagent\/versions-index\.json/));
    expect(config.define).toEqual({ "import.meta.env.DATA_CONTENT_ID": JSON.stringify(EMPTY_ID) });
  });

  it("only warns on the dev server when the data directory itself is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = runConfig(path.join(dataDir, "missing"), "serve");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/javaagent\/versions-index\.json/));
    expect(config.define).toEqual({ "import.meta.env.DATA_CONTENT_ID": JSON.stringify(EMPTY_ID) });
  });
});
