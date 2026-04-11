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
import { Github, BookOpen, Bug, MessageSquare } from "lucide-react";

const REPO_URL = "https://github.com/open-telemetry/opentelemetry-ecosystem-explorer";

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground">About</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          The OpenTelemetry Ecosystem Explorer is a community-driven tool for discovering and
          exploring projects, instrumentations, and components across the{" "}
          <a
            href="https://opentelemetry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            OpenTelemetry
          </a>{" "}
          ecosystem.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Goals</h2>
        <div className="rounded-lg border border-border/50 bg-card/50 p-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            The ecosystem is large and growing. Finding what instrumentation exists, what it
            produces, and how to configure it can be difficult. This project aims to make that
            information accessible and easy to navigate.
          </p>
          <p>
            By building a structured registry and an interactive explorer, we help developers
            understand what is available, what signals each component emits, and how components
            relate to OpenTelemetry semantic conventions.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Get Involved</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-5 hover:bg-card transition-colors"
          >
            <Github className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Source Code</h3>
              <p className="text-xs text-muted-foreground">
                Browse the repository, review open issues, and submit pull requests.
              </p>
            </div>
          </a>

          <a
            href="https://opentelemetry.io/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-5 hover:bg-card transition-colors"
          >
            <BookOpen className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">OpenTelemetry Docs</h3>
              <p className="text-xs text-muted-foreground">
                Learn about OpenTelemetry concepts, APIs, and SDKs at opentelemetry.io.
              </p>
            </div>
          </a>

          <a
            href={`${REPO_URL}/issues/new?labels=bug`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-5 hover:bg-card transition-colors"
          >
            <Bug className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Report a Bug</h3>
              <p className="text-xs text-muted-foreground">
                Found something wrong? Open an issue on GitHub and let us know.
              </p>
            </div>
          </a>

          <a
            href={`${REPO_URL}/issues/new?labels=enhancement`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-5 hover:bg-card transition-colors"
          >
            <MessageSquare
              className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Request a Feature</h3>
              <p className="text-xs text-muted-foreground">
                Have an idea? Open an issue to discuss it with the maintainers.
              </p>
            </div>
          </a>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Contributing</h2>
        <div className="rounded-lg border border-border/50 bg-card/50 p-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Contributions of all sizes are welcome — from fixing a typo to adding new ecosystem
            coverage. To get started, read the{" "}
            <a
              href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              contributing guide
            </a>
            .
          </p>
          <p>
            The project is part of the{" "}
            <a
              href="https://cloud-native.slack.com/archives/C09N6DDGSPQ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              #otel-ecosystem-explorer
            </a>{" "}
            channel on CNCF Slack. Join us there for questions, discussions, and updates.
          </p>
        </div>
      </section>
    </div>
  );
}
