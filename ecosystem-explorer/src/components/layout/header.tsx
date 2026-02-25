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
import { OtelLogo } from "@/components/icons/otel-logo";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-xl h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <OtelLogo className="h-6 w-6 text-primary" />
          <span className="font-semibold text-foreground">OTel Explorer</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/java-agent"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Java Agent
          </Link>
          <Link
            to="/collector"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Collector
          </Link>
        </nav>
      </div>
    </header>
  );
}
