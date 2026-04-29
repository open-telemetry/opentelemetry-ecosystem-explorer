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
import { Map } from "lucide-react";
import { Link } from "react-router-dom";
import { GitHubIcon } from "@/components/icons/github-icon";
import { OtelLogo } from "@/components/icons/otel-logo";

export function Footer() {
  return (
    <footer className="border-border/30 bg-background flex-shrink-0 border-t px-6 py-4">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
        <div className="flex w-full flex-col items-center gap-3 md:grid md:grid-cols-3">
          <div className="text-muted-foreground flex items-center gap-2">
            <OtelLogo className="text-primary h-5 w-5" />
            <span className="text-sm">OpenTelemetry Ecosystem Explorer</span>
          </div>
          <p className="text-muted-foreground hidden items-center justify-center gap-1.5 text-sm md:flex">
            <Map className="h-4 w-4" aria-hidden="true" />
            Charting the observability landscape
          </p>
          <nav className="text-muted-foreground flex items-center justify-end gap-4 text-sm">
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <a
              href="https://github.com/open-telemetry/opentelemetry-ecosystem-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
              aria-label="GitHub repository"
            >
              <GitHubIcon className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
            <a
              href="https://opentelemetry.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
              aria-label="OpenTelemetry website"
            >
              <OtelLogo className="h-4 w-4" aria-hidden="true" />
              opentelemetry.io
            </a>
          </nav>
        </div>
        <p className="text-muted-foreground text-xs">&copy; 2026–Present OpenTelemetry Authors</p>
      </div>
    </footer>
  );
}
