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

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";
import type {
  InstrumentationReleaseDiff,
  InstrumentationDiffStatus,
} from "@/features/java-agent/hooks/use-release-diff";
import { GlowBadge } from "@/components/ui/glow-badge";

interface ReleaseResultsTableProps {
  diffs: InstrumentationReleaseDiff[];
  fromVersion: string;
  toVersion: string;
}

export function ReleaseResultsTable({ diffs, fromVersion, toVersion }: ReleaseResultsTableProps) {
  const [search, setSearch] = useState("");
  const [showUnchanged, setShowUnchanged] = useState(false);

  const filtered = useMemo(() => {
    let result = diffs;
    if (!showUnchanged) {
      result = result.filter((d) => d.status !== "unchanged");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.displayName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [diffs, search, showUnchanged]);

  const unchangedCount = diffs.filter((d) => d.status === "unchanged").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[260px] flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            id="release-results-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter instrumentations…"
            aria-label="Filter instrumentations by name"
            className="border-border/60 bg-background/80 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 w-full rounded-lg border py-2 pl-9 pr-4 text-sm transition-all focus:ring-2 focus:outline-none"
          />
        </div>
        {unchangedCount > 0 && (
          <button
            type="button"
            aria-pressed={showUnchanged}
            onClick={() => setShowUnchanged((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
              showUnchanged
                ? "border-border bg-card text-foreground"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {showUnchanged ? "Hide" : "Show"} {unchangedCount} unchanged
          </button>
        )}
      </div>

      <div className="border-border/30 overflow-hidden rounded-xl border">
        <table className="w-full border-collapse" aria-label="Instrumentation changes">
          <thead>
            <tr className="bg-white/5">
              <th
                scope="col"
                className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
              >
                Instrumentation
              </th>
              <th
                scope="col"
                className="text-muted-foreground hidden p-3 text-left text-[10px] font-bold tracking-widest uppercase sm:table-cell"
              >
                Metrics Δ
              </th>
              <th
                scope="col"
                className="text-muted-foreground hidden p-3 text-left text-[10px] font-bold tracking-widest uppercase sm:table-cell"
              >
                Spans Δ
              </th>
              <th
                scope="col"
                className="text-muted-foreground p-3 text-left text-[10px] font-bold tracking-widest uppercase"
              >
                Status
              </th>
              <th scope="col" className="sr-only">
                View details
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-8 text-center text-sm">
                  No instrumentations match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((diff, index) => (
                <ReleaseInstrumentationRow
                  key={diff.name}
                  diff={diff}
                  fromVersion={fromVersion}
                  toVersion={toVersion}
                  striped={index % 2 === 1}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-right text-xs">
        Showing {filtered.length} of {diffs.length} instrumentations
      </p>
    </div>
  );
}

const STATUS_VARIANT: Record<
  InstrumentationDiffStatus,
  "success" | "error" | "warning" | "muted"
> = {
  added: "success",
  removed: "error",
  changed: "warning",
  unchanged: "muted",
};

interface ReleaseInstrumentationRowProps {
  diff: InstrumentationReleaseDiff;
  fromVersion: string;
  toVersion: string;
  striped: boolean;
}

function ReleaseInstrumentationRow({
  diff,
  fromVersion,
  toVersion,
  striped,
}: ReleaseInstrumentationRowProps) {
  // Link removed instrumentations back to fromVersion so the detail page loads successfully.
  const href =
    diff.status === "removed"
      ? `/java-agent/instrumentation/${fromVersion}/${diff.name}`
      : `/java-agent/instrumentation/${toVersion}/${diff.name}`;

  return (
    <tr className={striped ? "bg-muted/40" : ""}>
      <td className="p-3 sm:p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{diff.displayName}</span>
          {diff.displayName !== diff.name && (
            <code className="text-muted-foreground font-mono text-[11px]">{diff.name}</code>
          )}
        </div>
      </td>
      <td className="hidden p-3 sm:table-cell sm:p-4">
        <DeltaDisplay
          added={diff.metricsAdded}
          removed={diff.metricsRemoved}
          changed={diff.metricsChanged}
        />
      </td>
      <td className="hidden p-3 sm:table-cell sm:p-4">
        <DeltaDisplay
          added={diff.spansAdded}
          removed={diff.spansRemoved}
          changed={diff.spansChanged}
        />
      </td>
      <td className="p-3 sm:p-4">
        <GlowBadge variant={STATUS_VARIANT[diff.status]} className="capitalize text-[10px]">
          {diff.status}
        </GlowBadge>
      </td>
      <td className="p-3 sm:p-4">
        <Link
          to={href}
          aria-label={`View ${diff.displayName} instrumentation details`}
          className="text-muted-foreground hover:text-primary flex items-center justify-end transition-colors"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

interface DeltaDisplayProps {
  added: number;
  removed: number;
  changed: number;
}

function DeltaDisplay({ added, removed, changed }: DeltaDisplayProps) {
  if (added === 0 && removed === 0 && changed === 0) {
    return <span className="text-muted-foreground/60 text-sm">—</span>;
  }

  return (
    <div className="flex gap-2 font-mono text-xs">
      {added > 0 && <span className="text-green-400">+{added}</span>}
      {removed > 0 && <span className="text-red-400">−{removed}</span>}
      {changed > 0 && <span className="text-amber-400">~{changed}</span>}
    </div>
  );
}
