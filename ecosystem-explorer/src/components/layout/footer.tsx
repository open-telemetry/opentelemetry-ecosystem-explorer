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
import { Map, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { GitHubIcon } from "@/components/icons/github-icon";
import { OtelLogo } from "@/components/icons/otel-logo";
import { useTheme } from "@/theme-context";

export function Footer() {
  const { resolved } = useTheme();
  // Allow forcing the mobile layout for preview using ?mobilePreview=1
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isPreviewMobile = params?.get("mobilePreview") === "1";

  if (isPreviewMobile) {
    const isLight = resolved === "light";
    const cardClass = isLight
      ? "w-full rounded-2xl bg-white border border-border/10 p-6"
      : "w-full rounded-2xl bg-muted/10 border border-border/20 p-6";
    const iconBgClass = isLight
      ? "rounded-full p-2 border border-border/10 bg-background/5 flex items-center justify-center"
      : "rounded-full p-2 border border-border/10 bg-background/5 flex items-center justify-center";
    const linkTextClass = isLight
      ? "text-slate-600 group-hover:text-slate-900 transition-colors"
      : "text-muted-foreground group-hover:text-foreground transition-colors";

    return (
      <footer className="border-border/30 bg-background shrink-0 border-t px-4 py-6">
        <div className="mx-auto max-w-md flex flex-col items-center gap-3">
          <div className={cardClass}>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-full ${isLight ? "bg-muted/5" : "bg-muted/20"} p-2 flex items-center justify-center`}>
                  <OtelLogo className="text-primary h-6 w-6" />
                </div>
                <span className="text-sm text-muted-foreground">OpenTelemetry Ecosystem Explorer</span>
              </div>

              <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <Link to="/about" className="group hover:text-foreground flex items-center gap-2 transition-colors">
                  <span className={iconBgClass}>
                    <Info className="h-4 w-4" aria-hidden />
                  </span>
                  <span className={linkTextClass}>About</span>
                </Link>

                <a
                  href="https://github.com/open-telemetry/opentelemetry-ecosystem-explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group hover:text-foreground flex items-center gap-2 transition-colors"
                  aria-label="GitHub repository"
                >
                  <span className={iconBgClass}>
                    <GitHubIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className={linkTextClass}>GitHub</span>
                </a>

                <a
                  href="https://opentelemetry.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group hover:text-foreground flex items-center gap-2 transition-colors"
                  aria-label="OpenTelemetry website"
                >
                  <span className={iconBgClass}>
                    <OtelLogo className="h-4 w-4" aria-hidden />
                  </span>
                  <span className={linkTextClass}>opentelemetry.io</span>
                </a>
              </div>

              <p className="mt-3 text-center text-xs text-muted-foreground">&copy; 2026–Present OpenTelemetry Authors</p>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-border/30 bg-background shrink-0 border-t px-6 py-4">
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
          <nav className="text-muted-foreground flex items-center justify-center gap-4 text-sm md:justify-end">
            <Link
              to="/about"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
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
