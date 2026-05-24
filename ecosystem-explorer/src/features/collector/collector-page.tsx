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
import { PageContainer } from "@/components/layout/page-container";
import { BackButton } from "@/components/ui/back-button";
import { CollectorExploreLanding } from "@/features/collector/components/collector-explore-landing.tsx";
import { isEnabled } from "@/lib/feature-flags";

export function CollectorPage() {
  const collectorPageEnabled = isEnabled("COLLECTOR_PAGE");

  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
              OpenTelemetry Collector
            </span>
          </h1>
          <p className="text-muted-foreground">
            A vendor-agnostic implementation for receiving, processing, and exporting telemetry
            data.
          </p>
        </div>
        {collectorPageEnabled ? (
          <CollectorExploreLanding />
        ) : (
          <section className="border-border/60 bg-card/80 rounded-lg border p-8 text-center">
            <h2 className="text-foreground text-2xl font-bold">Collector explorer unavailable</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-2xl leading-relaxed">
              The Collector ecosystem explorer is not enabled for this deployment.
            </p>
          </section>
        )}
      </div>
    </PageContainer>
  );
}

export default CollectorPage;
