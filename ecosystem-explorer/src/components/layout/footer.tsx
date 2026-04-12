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
import { Github, Map } from "lucide-react";
import { Link } from "react-router-dom";
import { OtelLogo } from "@/components/icons/otel-logo";

export function Footer() {
  return (
    <footer className="border-t border-border/30 px-6 py-4 bg-background flex-shrink-0">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-3">
        <div className="flex flex-col md:grid md:grid-cols-3 items-center gap-3 w-full">
          <div className="flex items-center gap-2 text-muted-foreground">
            <OtelLogo className="h-5 w-5 text-primary" />
            <span className="text-sm">OpenTelemetry Ecosystem Explorer</span>
          </div>
          <p className="text-sm text-muted-foreground hidden md:flex items-center justify-center gap-1.5">
            <Map className="h-4 w-4" aria-hidden="true" />
            Charting the observability landscape
          </p>
          <nav className="flex items-center justify-end gap-4 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <a
              href="https://github.com/open-telemetry/opentelemetry-ecosystem-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
              aria-label="GitHub repository"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
            <a
              href="https://opentelemetry.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
              aria-label="OpenTelemetry website"
            >
              <OtelLogo className="h-4 w-4" aria-hidden="true" />
              opentelemetry.io
            </a>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">&copy; 2026–Present OpenTelemetry Authors</p>
      </div>
    </footer>
  );
}
