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
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { isEnabled } from "@/lib/feature-flags";

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

export default function App() {
  return (
    <BrowserRouter>
      <div className="bg-background flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-16">
          <Suspense>
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
                  <Route path="/collector/components/:version" element={<CollectorPage />} />
                  <Route
                    path="/collector/components/:version/:id"
                    element={<CollectorDetailPage />}
                  />
                </>
              )}
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
