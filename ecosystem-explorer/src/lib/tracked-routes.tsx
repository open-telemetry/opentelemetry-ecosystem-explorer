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
import { useEffect, useMemo, type ReactNode } from "react";
import {
  Routes,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
} from "react-router-dom";
import { setTrackedView } from "@/lib/telemetry";

/**
 * Drop-in `<Routes>` that names the Faro view after the matched route pattern
 * (`/collector/components/:distribution/:name`) rather than the concrete URL, so
 * RUM data groups by page type.
 *
 * Faro's own `FaroRoutes` is not used: it only emits `route_change` events (it
 * never sets the view), and it renders `undefined` when Faro is not initialized.
 */
export function TrackedRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  const routes = useMemo(() => createRoutesFromChildren(children), [children]);

  const pattern = useMemo(() => {
    const matches = matchRoutes(routes, location);
    if (!matches) return location.pathname;
    const path = matches
      .map((m) => m.route.path)
      .filter(Boolean)
      .join("/")
      .replace(/\/+/g, "/");
    return path || location.pathname;
  }, [routes, location]);

  useEffect(() => {
    setTrackedView(pattern);
  }, [pattern]);

  return <Routes>{children}</Routes>;
}
