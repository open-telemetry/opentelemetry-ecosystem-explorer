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
import { Link } from "react-router-dom";
import { Compass } from "@/components/icons/compass";
import { PageContainer } from "@/components/layout/page-container";

export function NotFoundPage() {
  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center">
      <Compass className="mb-8 h-32 w-32 opacity-50" />

      <h1 className="text-foreground mb-4 text-4xl font-bold">404 - Page Not Found</h1>

      <p className="text-muted-foreground mb-8 max-w-md text-center">
        The page you're looking for doesn't exist. You may have mistyped the address or the page may
        have moved.
      </p>

      <Link
        to="/"
        className="bg-secondary/10 border-secondary/40 text-foreground hover:bg-secondary/20 rounded-lg border px-6 py-3 transition-colors"
      >
        Return to Home
      </Link>
    </PageContainer>
  );
}
