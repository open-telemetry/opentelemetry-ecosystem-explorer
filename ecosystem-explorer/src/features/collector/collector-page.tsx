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
import { isEnabled } from "@/lib/feature-flags";
import { PageContainer } from "@/components/layout/page-container";

export function CollectorPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground mb-2 text-3xl font-bold">OpenTelemetry Collector</h1>
          <p className="text-muted-foreground">
            Navigate Collector components like receivers, processors, and exporters.
          </p>
        </div>

        {isEnabled("COLLECTOR_PAGE") ? (
          <div className="border-border/50 bg-card/50 rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">Insert Collector explorer here ...</p>
          </div>
        ) : (
          <div className="border-border/50 bg-card/50 rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">Collector explorer coming soon...</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
