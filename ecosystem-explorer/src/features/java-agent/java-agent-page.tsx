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
import { AgentExploreLanding } from "@/features/java-agent/components/agent-explore-landing.tsx";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";

export function JavaAgentPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold md:text-4xl mb-2">
            <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
              OpenTelemetry Java Agent
            </span>
          </h1>
          <p className="text-muted-foreground">
            Explore auto-instrumentation for Java applications. Discover supported libraries,
            configuration options, and emitted telemetry.
          </p>
        </div>
        <AgentExploreLanding />
      </div>
    </PageContainer>
  );
}
