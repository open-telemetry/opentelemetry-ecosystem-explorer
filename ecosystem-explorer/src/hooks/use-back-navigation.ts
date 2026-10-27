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
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Returns the path one segment up from `pathname`, e.g. `/java-agent/releases` -> `/java-agent`.
 */
export function getParentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return "/" + segments.slice(0, -1).join("/");
}

/**
 * Hook that returns a handler for "Back" controls.
 *
 * Goes back in history when the user navigated here from within the app. When the page was
 * opened directly (bookmark, shared link, new tab), there is no in-app entry to go back to and
 * `navigate(-1)` would leave the site, so it navigates to `fallbackTo` instead, defaulting to
 * the parent path.
 */
export function useBackNavigation(fallbackTo?: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    // BrowserRouter keeps the entry's position in `history.state.idx`: 0 for the first entry of
    // the app, incremented on push and kept on replace. `location.key` is not enough, because a
    // page that rewrites its URL on load (e.g. the release comparison adding ?from=&to=) gets a
    // new key without any in-app entry to go back to.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index === 0) {
      // Replace rather than push, so the fallback page is again the first entry and the next
      // Back continues up the hierarchy instead of returning to this page.
      void navigate(fallbackTo ?? getParentPath(location.pathname), { replace: true });
    } else {
      void navigate(-1);
    }
  };
}
