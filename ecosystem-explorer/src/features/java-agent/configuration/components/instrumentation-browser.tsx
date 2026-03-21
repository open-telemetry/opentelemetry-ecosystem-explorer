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
import { useMemo, useState } from "react";
import { useInstrumentations } from "@/hooks/use-javaagent-data";
import { useConfigurationBuilder } from "../hooks/use-configuration-builder";
import { getInstrumentationDisplayName } from "../../utils/format";
import type { InstrumentationData } from "@/types/javaagent";

export function InstrumentationBrowser() {
  const { state, dispatch } = useConfigurationBuilder();
  const { data: instrumentations, loading } = useInstrumentations(state.version);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInstrumentations = useMemo(() => {
    if (!instrumentations) return [];

    return instrumentations.filter((instr) => {
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const name = getInstrumentationDisplayName(instr).toLowerCase();
        const description = (instr.description || "").toLowerCase();

        return name.includes(searchLower) || description.includes(searchLower);
      }
      return true;
    });
  }, [instrumentations, searchQuery]);

  const selectedInstrumentations = useMemo(() => {
    return Array.from(state.selectedInstrumentations.values());
  }, [state.selectedInstrumentations]);

  const availableInstrumentations = useMemo(() => {
    return filteredInstrumentations.filter(
      (instr) => !state.selectedInstrumentations.has(instr.name)
    );
  }, [filteredInstrumentations, state.selectedInstrumentations]);

  const handleAddAll = () => {
    dispatch({
      type: "ADD_ALL_INSTRUMENTATIONS",
      instrumentations: availableInstrumentations,
    });
  };

  const handleToggleInstrumentation = (instr: InstrumentationData) => {
    if (state.selectedInstrumentations.has(instr.name)) {
      dispatch({ type: "REMOVE_INSTRUMENTATION", name: instr.name });
    } else {
      dispatch({
        type: "ADD_INSTRUMENTATION",
        name: instr.name,
        data: instr,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading instrumentations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="instrumentation-search" className="sr-only">
          Search instrumentations
        </label>
        <input
          id="instrumentation-search"
          type="text"
          placeholder="Search instrumentations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Search instrumentations"
        />
      </div>

      {selectedInstrumentations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Selected ({selectedInstrumentations.length})
            </h3>
            <button
              onClick={() => dispatch({ type: "REMOVE_ALL_INSTRUMENTATIONS" })}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Remove All
            </button>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {selectedInstrumentations.map((config) => (
              <div
                key={config.name}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-primary/10 border border-primary/20"
              >
                <span className="text-sm font-medium truncate">
                  {getInstrumentationDisplayName(config.data)}
                </span>
                <button
                  onClick={() => handleToggleInstrumentation(config.data)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${getInstrumentationDisplayName(config.data)}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Available ({availableInstrumentations.length})
          </h3>
          <button
            onClick={handleAddAll}
            disabled={availableInstrumentations.length === 0}
            className="text-xs text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            Add All
          </button>
        </div>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {availableInstrumentations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {searchQuery
                ? "No instrumentations match your search"
                : "All instrumentations selected"}
            </p>
          ) : (
            availableInstrumentations.map((instr) => (
              <label
                key={instr.name}
                className="flex items-start gap-3 px-3 py-2 rounded hover:bg-muted/50 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleToggleInstrumentation(instr)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  aria-label={`Select ${getInstrumentationDisplayName(instr)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground group-hover:text-primary">
                    {getInstrumentationDisplayName(instr)}
                  </div>
                  {instr.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {instr.description}
                    </div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
