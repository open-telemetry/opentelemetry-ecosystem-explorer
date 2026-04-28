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
    <header className="border-border/30 bg-background/95 fixed top-0 right-0 left-0 z-50 h-16 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <OtelLogo className="text-primary h-6 w-6" />
          <span className="text-foreground font-semibold">OTel Explorer</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            to="/java-agent"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Java Agent
          </Link>
          <Link
            to="/collector"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Collector
          </Link>
        </nav>
      </div>
    </header>
  );
}
