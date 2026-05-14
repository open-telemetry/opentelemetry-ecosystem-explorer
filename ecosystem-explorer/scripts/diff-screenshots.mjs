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
 * Compare two directories of PNG screenshots and emit per-file pixel diffs.
 *
 * Usage:
 *   bun scripts/diff-screenshots.mjs <baselineDir> <currentDir> [diffDir]
 *
 * Walks `<currentDir>` looking for `.png` files, matches each to a sibling
 * in `<baselineDir>` by relative path, and runs `pixelmatch` between them.
 * A diff PNG is written to `<diffDir>` (default: `diffs/`) for every pair
 * with at least one differing pixel. New files (in current but not baseline)
 * and missing files (in baseline but not current) are recorded but produce
 * no diff image.
 *
 * Exit code is 0 if every changed pair is within the per-file threshold and
 * no files are new/missing. Non-zero otherwise so CI can gate on it.
 *
 * Tunables (env vars):
 *   PIXELMATCH_THRESHOLD    Per-pixel sensitivity, 0–1 (default: 0.1)
 *   DIFF_RATIO_THRESHOLD    Acceptable changed-pixel ratio, 0–1 (default: 0.001 = 0.1%)
 */

import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const PIXELMATCH_THRESHOLD = Number(process.env.PIXELMATCH_THRESHOLD ?? "0.1");
const DIFF_RATIO_THRESHOLD = Number(process.env.DIFF_RATIO_THRESHOLD ?? "0.001");

function readPng(file) {
  const data = fs.readFileSync(file);
  return PNG.sync.read(data);
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile() && entry.name.endsWith(".png")) out.push(path.relative(base, full));
  }
  return out;
}

function main() {
  const [, , baselineDir, currentDir, diffDirArg] = process.argv;
  if (!baselineDir || !currentDir) {
    console.error("usage: diff-screenshots.mjs <baselineDir> <currentDir> [diffDir]");
    process.exit(2);
  }
  const diffDir = path.resolve(diffDirArg ?? "diffs");
  fs.mkdirSync(diffDir, { recursive: true });

  const currentFiles = walk(path.resolve(currentDir));
  const baselineFiles = new Set(walk(path.resolve(baselineDir)));

  const report = { matched: 0, changed: [], newFiles: [], missing: [] };

  for (const rel of currentFiles) {
    const currentPath = path.join(currentDir, rel);
    const baselinePath = path.join(baselineDir, rel);
    baselineFiles.delete(rel);

    if (!fs.existsSync(baselinePath)) {
      report.newFiles.push(rel);
      continue;
    }

    const a = readPng(baselinePath);
    const b = readPng(currentPath);
    if (a.width !== b.width || a.height !== b.height) {
      report.changed.push({ file: rel, reason: "dimension-mismatch", changedRatio: 1 });
      continue;
    }

    const diff = new PNG({ width: a.width, height: a.height });
    const changedPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
      threshold: PIXELMATCH_THRESHOLD,
    });
    const changedRatio = changedPixels / (a.width * a.height);

    if (changedPixels === 0) {
      report.matched += 1;
      continue;
    }

    const diffOut = path.join(diffDir, rel);
    fs.mkdirSync(path.dirname(diffOut), { recursive: true });
    fs.writeFileSync(diffOut, PNG.sync.write(diff));
    report.changed.push({ file: rel, changedPixels, changedRatio });
  }

  for (const rel of baselineFiles) report.missing.push(rel);

  const overBudget = report.changed.filter((c) => c.changedRatio > DIFF_RATIO_THRESHOLD);
  const summary = {
    matched: report.matched,
    changed: report.changed.length,
    overBudget: overBudget.length,
    new: report.newFiles.length,
    missing: report.missing.length,
    threshold: { perPixel: PIXELMATCH_THRESHOLD, perFileRatio: DIFF_RATIO_THRESHOLD },
  };

  console.log(JSON.stringify({ summary, report }, null, 2));

  const failed = overBudget.length > 0 || report.newFiles.length > 0 || report.missing.length > 0;
  process.exit(failed ? 1 : 0);
}

main();
