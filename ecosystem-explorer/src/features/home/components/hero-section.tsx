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
import { Compass } from "@/components/icons/compass";

export function HeroSection() {
  return (
    <section className="relative flex items-center justify-center overflow-hidden bg-background py-12">
      {/* Ambient radial gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--primary-hsl) / 0.08) 0%, hsl(var(--secondary-hsl) / 0.04) 30%, transparent 70%)",
        }}
      />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border-hsl)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-hsl)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Compass with glow ring */}
        <div
          className="inline-flex rounded-full p-4"
          style={{
            boxShadow: "0 0 60px hsl(var(--primary-hsl) / 0.2)",
          }}
        >
          <Compass className="h-24 w-24 text-foreground md:h-32 md:w-32" />
        </div>

        <div className="space-y-2">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            <span className="text-foreground">OpenTelemetry</span>
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
              Ecosystem Explorer
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground md:text-base">
            Navigate the vast landscape of OpenTelemetry.
          </p>
        </div>
      </div>

      {/* Bottom fade transition */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-64"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background-hsl)) 0%, hsl(var(--background-hsl) / 0.6) 30%, transparent 100%)",
        }}
      />
    </section>
  );
}
