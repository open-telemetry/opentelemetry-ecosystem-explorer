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
import { JavaInstrumentationIcon } from "@/components/icons/java-instrumentation-icon";
import { ConfigurationIcon } from "@/components/icons/configuration-icon";
import { NavigationCard } from "@/components/ui/navigation-card";

export function AgentExploreLanding() {
  return (
    <section className="relative py-8 px-6 bg-background">
      {/* Section divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-4">
          <NavigationCard
            title="Instrumentation Libraries"
            description="Explore auto-instrumentation for Java applications. Discover supported libraries, configuration options, and emitted telemetry."
            href="/java-agent/instrumentation"
            icon={<JavaInstrumentationIcon className="h-20 w-20" />}
          />
          <NavigationCard
            title="Configuration Options"
            description="Discover options for configuring the Java Agent and instrumentation."
            href="/java-agent/configuration"
            icon={<ConfigurationIcon className="h-20 w-20" />}
          />
        </div>
      </div>
    </section>
  );
}
