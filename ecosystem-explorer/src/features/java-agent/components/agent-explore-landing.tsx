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
import { ReleaseIcon } from "@/components/icons/release-icon";
import { NavigationCard } from "@/components/ui/navigation-card";
import { isEnabled } from "@/lib/feature-flags";

export function AgentExploreLanding() {
  return (
    <section className="bg-background relative px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-4 md:grid-cols-2">
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
          {isEnabled("JAVA_RELEASE_COMPARISON") && (
            <NavigationCard
              title="Releases"
              description="Compare Java Agent versions to see changes in telemetry and configuration."
              href="/java-agent/releases"
              icon={<ReleaseIcon className="h-20 w-20" />}
            />
          )}
        </div>
      </div>
    </section>
  );
}
