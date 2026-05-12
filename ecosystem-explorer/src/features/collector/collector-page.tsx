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

export function CollectorPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
              OpenTelemetry Collector
        <header className="space-y-4">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            Collector{" "}
            <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
              Components
            </span>
          </h1>
          <p className="text-muted-foreground">
            A vendor-agnostic implementation for receiving, processing, and exporting telemetry
            data.
          </p>
        </div>
        <CollectorExploreLanding />
        </header>

        {!isEnabled("COLLECTOR_PAGE") ? (
          <div className="border-border/40 bg-card/30 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center backdrop-blur-sm">
            <div className="bg-secondary/10 mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full">
              <Box className="text-secondary h-10 w-10 animate-pulse" aria-hidden="true" />
            </div>
            <h2 className="text-foreground text-2xl font-bold tracking-tight">Coming Soon</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-lg leading-relaxed">
              We're currently building the Collector component explorer. Stay tuned for a
              comprehensive view of receivers, processors, and more!
            </p>
          </div>
        ) : (
          <CollectorPageInner urlVersion={urlVersion} />
        )}
      </div>
    </PageContainer>
  );
}

export default CollectorPage;
