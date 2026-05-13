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

/**
 * JavaReleaseComparisonPage provides a tool to compare different versions of the Java Agent.
 * This is currently a skeleton as part of the incremental feature rollout.
 */
export function JavaReleaseComparisonPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <BackButton />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold md:text-4xl">
            <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
              Release Comparison
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Compare Java Agent releases to discover new features and changes in telemetry.
          </p>
        </div>

        <div className="border-border flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center">
          <div className="bg-secondary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-secondary text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-semibold">Under Development</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            The Java Agent Release Comparison tool is currently being built. Check back soon to
            compare telemetry changes across versions.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
