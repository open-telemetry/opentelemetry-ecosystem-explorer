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
import { useTranslation, Trans } from "react-i18next";
import { BookOpen, Bug, MessageSquare } from "lucide-react";
import { GitHubIcon } from "@/components/icons/github-icon";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";

const REPO_URL = "https://github.com/open-telemetry/opentelemetry-ecosystem-explorer";

export function AboutPage() {
  const { t } = useTranslation("about");
  return (
    <PageContainer>
      <div className="space-y-6">
        <BackButton />
        <div className="mx-auto max-w-4xl space-y-10 py-12">
          <div className="space-y-3">
            <h1 className="text-foreground text-3xl font-bold">{t("intro.heading")}</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              <Trans
                i18nKey="intro.description"
                ns="about"
                components={{
                  otelLink: (
                    <a
                      href="https://opentelemetry.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    />
                  ),
                }}
              />
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-foreground text-xl font-semibold">{t("goals.heading")}</h2>
            <div className="border-border/50 bg-card/50 text-muted-foreground space-y-3 rounded-lg border p-6 text-sm leading-relaxed">
              <p>{t("goals.body1")}</p>
              <p>{t("goals.body2")}</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground text-xl font-semibold">{t("getInvolved.heading")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/50 bg-card/50 hover:bg-card flex items-start gap-4 rounded-lg border p-5 transition-colors"
              >
                <GitHubIcon
                  className="text-secondary mt-0.5 h-5 w-5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <h3 className="text-foreground text-sm font-medium">
                    {t("getInvolved.sourceCode.title")}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {t("getInvolved.sourceCode.description")}
                  </p>
                </div>
              </a>

              <a
                href="https://opentelemetry.io/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/50 bg-card/50 hover:bg-card flex items-start gap-4 rounded-lg border p-5 transition-colors"
              >
                <BookOpen
                  className="text-secondary mt-0.5 h-5 w-5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <h3 className="text-foreground text-sm font-medium">
                    {t("getInvolved.docs.title")}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {t("getInvolved.docs.description")}
                  </p>
                </div>
              </a>

              <a
                href={`${REPO_URL}/issues/new?labels=bug`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/50 bg-card/50 hover:bg-card flex items-start gap-4 rounded-lg border p-5 transition-colors"
              >
                <Bug className="text-secondary mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="text-foreground text-sm font-medium">
                    {t("getInvolved.reportBug.title")}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {t("getInvolved.reportBug.description")}
                  </p>
                </div>
              </a>

              <a
                href={`${REPO_URL}/issues/new?labels=enhancement`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/50 bg-card/50 hover:bg-card flex items-start gap-4 rounded-lg border p-5 transition-colors"
              >
                <MessageSquare
                  className="text-secondary mt-0.5 h-5 w-5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <h3 className="text-foreground text-sm font-medium">
                    {t("getInvolved.requestFeature.title")}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {t("getInvolved.requestFeature.description")}
                  </p>
                </div>
              </a>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-foreground text-xl font-semibold">{t("contributing.heading")}</h2>
            <div className="border-border/50 bg-card/50 text-muted-foreground space-y-3 rounded-lg border p-6 text-sm leading-relaxed">
              <p>
                <Trans
                  i18nKey="contributing.body1"
                  ns="about"
                  components={{
                    guideLink: (
                      <a
                        href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      />
                    ),
                  }}
                />
              </p>
              <p>
                <Trans
                  i18nKey="contributing.body2"
                  ns="about"
                  components={{
                    slackLink: (
                      <a
                        href="https://cloud-native.slack.com/archives/C09N6DDGSPQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      />
                    ),
                  }}
                />
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
