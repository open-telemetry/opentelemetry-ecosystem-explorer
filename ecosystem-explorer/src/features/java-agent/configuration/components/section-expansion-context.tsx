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

interface ExpansionSignal {
  action: "expand" | "collapse";
  nonce: number;
}

interface SectionExpansionContextValue {
  expandAll: () => void;
  collapseAll: () => void;
  signal: ExpansionSignal | null;
}

const SectionExpansionContext = createContext<SectionExpansionContextValue | null>(null);

export function SectionExpansionProvider({ children }: { children: ReactNode }) {
  const [signal, setSignal] = useState<ExpansionSignal | null>(null);

  const expandAll = useCallback(() => {
    setSignal((prev) => ({ action: "expand", nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const collapseAll = useCallback(() => {
    setSignal((prev) => ({ action: "collapse", nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  return (
    <SectionExpansionContext.Provider value={{ expandAll, collapseAll, signal }}>
      {children}
    </SectionExpansionContext.Provider>
  );
}

export function useSectionExpansion(): SectionExpansionContextValue {
  const ctx = useContext(SectionExpansionContext);
  if (!ctx) {
    return {
      expandAll: () => {},
      collapseAll: () => {},
      signal: null,
    };
  }
  return ctx;
}
