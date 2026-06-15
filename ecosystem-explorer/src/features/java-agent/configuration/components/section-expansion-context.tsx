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
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type BulkAction = "expand" | "collapse" | null;

interface SectionExpansionContextValue {
  expandAll: () => void;
  collapseAll: () => void;
  bulkAction: BulkAction;
  /** Overrides per section key set after a bulk action. */
  overrides: Record<string, boolean>;
  setOverride: (key: string, value: boolean) => void;
}

const SectionExpansionContext = createContext<SectionExpansionContextValue | null>(null);

export function SectionExpansionProvider({ children }: { children: ReactNode }) {
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const expandAll = useCallback(() => {
    setBulkAction("expand");
    setOverrides({});
  }, []);

  const collapseAll = useCallback(() => {
    setBulkAction("collapse");
    setOverrides({});
  }, []);

  const setOverride = useCallback((key: string, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <SectionExpansionContext.Provider
      value={{ expandAll, collapseAll, bulkAction, overrides, setOverride }}
    >
      {children}
    </SectionExpansionContext.Provider>
  );
}

const NO_OP_CONTEXT: SectionExpansionContextValue = {
  expandAll: () => {},
  collapseAll: () => {},
  bulkAction: null,
  overrides: {},
  setOverride: () => {},
};
// eslint-disable-next-line react-refresh/only-export-components
export function useSectionExpansion(): SectionExpansionContextValue {
  const ctx = useContext(SectionExpansionContext);
  return ctx ?? NO_OP_CONTEXT;
}
