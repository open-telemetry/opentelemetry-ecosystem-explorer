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
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomePage } from "@/features/home/home-page";
import { JavaAgentPage } from "@/features/java-agent/java-agent-page";
import { CollectorPage } from "@/features/collector/collector-page";
import { CollectorDetailPage } from "@/features/collector/collector-detail-page";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { JavaInstrumentationListPage } from "@/features/java-agent/java-instrumentation-list-page";
import { JavaConfigurationListPage } from "@/features/java-agent/java-configuration-list-page";
import { InstrumentationDetailPage } from "@/features/java-agent/instrumentation-detail-page";
import { ConfigurationBuilderPage } from "@/features/java-agent/configuration/configuration-builder-page";
import { AboutPage } from "@/features/about/about-page";
import { isEnabled } from "@/lib/feature-flags";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-16">
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
            {isEnabled("JAVA_CONFIG_BUILDER") && (
              <Route
                path="/java-agent/configuration/builder"
                element={<ConfigurationBuilderPage />}
              />
            )}
            {isEnabled("COLLECTOR_PAGE") && (
              <>
                <Route path="/collector" element={<CollectorPage />} />
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
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
