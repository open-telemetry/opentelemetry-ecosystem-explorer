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
import { BackButton } from "@/components/ui/back-button";

export function JavaConfigurationListPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            OpenTelemetry Java Agent Configuration
          </h1>
        </div>

        <div className="rounded-lg border border-border/50 bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">Coming Soon...</p>
        </div>
      </div>
    </div>
  );
}
