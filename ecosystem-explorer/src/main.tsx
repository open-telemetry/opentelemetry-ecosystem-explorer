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
 * Flag the document root so CSS can gate v1-redesign-only token overrides
 * (e.g. page background) without each consumer plumbing the flag through
 * React. Runs once at bundle load, before the first paint, so there's no
 * flash. The flag itself is read from an env var at build time.
 */
if (isEnabled("V1_REDESIGN")) {
  document.documentElement.setAttribute("data-v1-redesign", "true");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
