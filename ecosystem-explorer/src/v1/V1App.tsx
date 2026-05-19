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
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Footer } from "@/components/layout/footer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { isEnabled } from "@/lib/feature-flags";
import { NavBar } from "@/v1/components/layout/nav-bar";
import "@/v1/styles/index.css";

/*
 * V1 sub-app entry. Reached via the V1_REDESIGN boundary read in `src/App.tsx`.
 * Owns its own `<Routes>` and v1 chrome. The legacy `<Footer />` is reused as a
 * temporary placeholder until PR 6 ships `<FooterV1 />` + `<CncfCallout />`.
 *
 * The `.v1-app` wrapper class scopes v1-specific surface-token overrides defined
 * in `src/v1/styles/tokens.css` so they don't leak into the legacy app.
 *
 * Route paths mirror `<LegacyApp />` verbatim — both sub-apps share the
 * canonical path space, and the boundary read decides which is reachable per
 * deploy. Phase 2-5 PRs each swap one route's component to its v1 version.
 *
 * Route-sync: the route table below mirrors `src/LegacyApp.tsx`. Any new global
 * route added here must also be added there until LegacyApp.tsx is deleted,
 * otherwise the route is reachable only in v1 builds and 404s in legacy.
 */

const HomePage = lazy(() =>
  import("@/features/home/home-page").then((m) => ({ default: m.HomePage }))
);
const JavaAgentPage = lazy(() =>
  import("@/features/java-agent/java-agent-page").then((m) => ({ default: m.JavaAgentPage }))
);
const CollectorPage = lazy(() =>
  import("@/features/collector/collector-page").then((m) => ({ default: m.CollectorPage }))
);
const CollectorDetailPage = lazy(() =>
  import("@/features/collector/collector-detail-page").then((m) => ({
    default: m.CollectorDetailPage,
  }))
);
const NotFoundPage = lazy(() =>
  import("@/features/not-found/not-found-page").then((m) => ({ default: m.NotFoundPage }))
);
const JavaInstrumentationListPage = lazy(() =>
  import("@/features/java-agent/java-instrumentation-list-page").then((m) => ({
    default: m.JavaInstrumentationListPage,
  }))
);
const JavaConfigurationListPage = lazy(() =>
  import("@/features/java-agent/java-configuration-list-page").then((m) => ({
    default: m.JavaConfigurationListPage,
  }))
);
const JavaReleaseComparisonPage = lazy(() =>
  import("@/features/java-agent/java-release-comparison-page").then((m) => ({
    default: m.JavaReleaseComparisonPage,
  }))
);
const InstrumentationDetailPage = lazy(() =>
  import("@/features/java-agent/instrumentation-detail-page").then((m) => ({
    default: m.InstrumentationDetailPage,
  }))
);
const ConfigurationBuilderPage = lazy(() =>
  import("@/features/java-agent/configuration/configuration-builder-page").then((m) => ({
    default: m.ConfigurationBuilderPage,
  }))
);
const AboutPage = lazy(() =>
  import("@/features/about/about-page").then((m) => ({ default: m.AboutPage }))
);
const DevComponentsPage = lazy(() =>
  import("@/v1/features/_dev/components-page").then((m) => ({ default: m.DevComponentsPage }))
);

export function V1App() {
  return (
    <div className="v1-app bg-background flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 pt-16">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div
                className="flex min-h-[400px] items-center justify-center"
                role="status"
                aria-live="polite"
              >
                <div className="text-muted-foreground text-sm font-medium">Loading…</div>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/java-agent" element={<JavaAgentPage />} />
              <Route path="/java-agent/instrumentation" element={<JavaInstrumentationListPage />} />
              <Route
                path="/java-agent/instrumentation/:version"
                element={<JavaInstrumentationListPage />}
              />
              <Route
                path="/java-agent/instrumentation/:version/:name"
                element={<InstrumentationDetailPage />}
              />
              <Route path="/java-agent/configuration" element={<JavaConfigurationListPage />} />
              {isEnabled("JAVA_RELEASE_COMPARISON") && (
                <Route path="/java-agent/releases" element={<JavaReleaseComparisonPage />} />
              )}
              {isEnabled("JAVA_CONFIG_BUILDER") && (
                <Route
                  path="/java-agent/configuration/builder"
                  element={<ConfigurationBuilderPage />}
                />
              )}
              <Route path="/collector" element={<CollectorPage />} />
              {isEnabled("COLLECTOR_PAGE") && (
                <>
                  <Route path="/collector/components" element={<CollectorPage />} />
                  <Route
                    path="/collector/components/:distribution/:name"
                    element={<CollectorDetailPage />}
                  />
                </>
              )}
              <Route path="/about" element={<AboutPage />} />
              {isEnabled("DEV_SHOWCASE") && (
                <Route path="/_dev/components" element={<DevComponentsPage />} />
              )}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
