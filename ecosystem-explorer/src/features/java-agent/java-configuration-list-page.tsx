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
import { ConfigurationIcon } from "@/components/icons/configuration-icon";
import { BackButton } from "@/components/ui/back-button";
import { NavigationCard } from "@/components/ui/navigation-card";
import { isEnabled } from "@/lib/feature-flags";
import { PageContainer } from "@/components/layout/page-container";

export function JavaConfigurationListPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
              OpenTelemetry Java Agent Configuration
            </span>
          </h1>
        </div>
        {isEnabled("JAVA_CONFIG_BUILDER") ? (
          <NavigationCard
            title="Configuration Builder"
            description="Build and customize your OpenTelemetry Java Agent configuration"
            href="/java-agent/configuration/builder"
            icon={<ConfigurationIcon className="h-16 w-16" />}
          />
        ) : (
          <div className="border-border/50 bg-card/50 rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">Configuration Builder coming soon...</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
