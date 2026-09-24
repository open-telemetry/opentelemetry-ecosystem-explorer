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

import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { SemanticConventionsLanding } from "./components/semantic-conventions-landing";

export function SemanticConventionsPage() {
  const { t } = useTranslation("semantic-conventions");
  return (
    <PageContainer>
      <Seo />
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">
            <span className="text-gradient-brand">{t("landing.page.title")}</span>
          </h1>
          <p className="text-muted-foreground">{t("landing.page.description")}</p>
        </div>
        <SemanticConventionsLanding />
      </div>
    </PageContainer>
  );
}
