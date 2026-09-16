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

import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/*
 * Resets window scroll when the route's pathname changes. `BrowserRouter`'s
 * pushState navigation leaves the window where the previous page left it, so a
 * link clicked at the bottom of one page would open the next one scrolled to
 * the bottom.
 *
 * Keyed on `pathname` only: query-string updates (list filters, detail tabs)
 * and hash writes keep the user's position. Back/forward (`POP`) is left to
 * the browser's own scroll restoration.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
