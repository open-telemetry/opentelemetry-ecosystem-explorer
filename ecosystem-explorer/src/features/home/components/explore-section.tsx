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
import { JavaIcon } from "@/components/icons/java-icon";
import { PipelineIcon } from "@/components/icons/pipeline-icon";
import { NavigationCard } from "@/components/ui/navigation-card";

export function ExploreSection() {
  return (
    <section className="bg-background relative px-6">
      {/* Subtle ambient glow at top */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-64 w-full max-w-3xl -translate-x-1/2 -translate-y-16"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary-hsl) / 0.04) 0%, transparent 80%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Navigation cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <NavigationCard
            title="OpenTelemetry Java Agent"
            description="Explore auto-instrumentation for Java applications. Discover supported libraries, configuration options, and emitted telemetry."
            href="/java-agent"
            icon={<JavaIcon className="h-20 w-20" />}
          />
          <NavigationCard
            title="OpenTelemetry Collector"
            description="Navigate Collector components like receivers, processors, and exporters."
            href="/collector"
            icon={<PipelineIcon className="h-20 w-20" />}
          />
        </div>
      </div>
    </section>
  );
}
