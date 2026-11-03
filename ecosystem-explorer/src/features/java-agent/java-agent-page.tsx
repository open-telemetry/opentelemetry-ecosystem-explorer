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
import { JavaAgentInfoBar } from "@/features/java-agent/components/java-agent-info-bar.tsx";
import { JavaAgentAnnouncements } from "@/features/java-agent/components/java-agent-announcements.tsx";
import { useJavaAgentSummary } from "./hooks/use-java-agent-summary";
import { useJavaAgentAnnouncements } from "./hooks/use-java-agent-announcements";
import { Loader } from "@/components/ui/loader";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { useTranslation } from "react-i18next";

export function JavaAgentPage() {
  const { t } = useTranslation("java-agent");
  const summary = useJavaAgentSummary();
  const announcements = useJavaAgentAnnouncements();
  const loading = summary.loading || announcements.loading;

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <span className="text-gradient-brand">{t("page.title")}</span>
          </h1>
          <p className="text-muted-foreground">{t("page.description")}</p>
        </div>
        {loading ? (
          <Loader label={t("page.loading")} />
        ) : (
          <>
            <JavaAgentInfoBar summary={summary} />
            <JavaAgentAnnouncements announcements={announcements} />
            <AgentExploreLanding />
          </>
        )}
      </div>
    </PageContainer>
  );
}
