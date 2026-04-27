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
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ConfigurationBuilderPage } from "@/features/java-agent/configuration/configuration-builder-page";

const ROUTE = "/java-agent/configuration/builder";

/**
 * Renders ConfigurationBuilderPage inside a MemoryRouter at its production
 * route. Shared by every `configuration-builder-*.integration.test.tsx`
 * file.
 */
export function renderBuilderPage() {
  return render(
    <MemoryRouter initialEntries={[ROUTE]}>
      <Routes>
        <Route path={ROUTE} element={<ConfigurationBuilderPage />} />
      </Routes>
    </MemoryRouter>
  );
}
