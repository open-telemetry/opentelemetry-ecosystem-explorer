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
import "./faro";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./theme-context";
import { isEnabled } from "./lib/feature-flags";

/*
 * Apply `.v1-app` to <html> before React mounts so the body background uses
 * v1 surface tokens (`src/v1/styles/tokens.css`) from the first paint. Without
 * this, body would briefly render against the legacy navy palette during the
 * React mount window before `<V1App />`'s wrapper div applies its override.
 *
 * This is the only flag read outside `src/App.tsx`'s boundary. The
 * 2026-05-12 pivot collapsed per-component flag sprawl into a single
 * App.tsx boundary read; this narrow early-paint marker is the carve-out
 * needed to keep body bg painted correctly without a flash. CSS variables
 * declared on `<html>` cascade to `<body>` via `body { background-color:
 * hsl(var(--background-hsl)) }` in `src/styles/base.css`.
 */
if (isEnabled("V1_REDESIGN")) {
  document.documentElement.classList.add("v1-app");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
