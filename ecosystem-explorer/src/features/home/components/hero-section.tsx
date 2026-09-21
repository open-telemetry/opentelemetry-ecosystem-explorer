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
import { Compass } from "@/components/icons/compass";

export function HeroSection() {
  const { t } = useTranslation("home");
  return (
    <section className="bg-background relative flex items-center justify-center overflow-hidden py-12">
      {/* Ambient radial gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--hero-accent-hsl) / var(--hero-gradient-opacity)) 0%, hsl(var(--hero-accent-alt-hsl) / calc(var(--hero-gradient-opacity) / 2)) 30%, transparent 70%)",
        }}
      />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0" style={{ opacity: "var(--hero-grid-opacity)" }}>
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
      <div className="relative z-10 flex w-full max-w-6xl flex-col-reverse items-center gap-10 px-6 md:flex-row md:justify-between md:gap-16">
        <div className="space-y-4 text-center md:text-left">
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance md:text-5xl lg:text-6xl">
            <span className="text-foreground">{t("hero.titlePrefix")}</span>
            <br />
            <span className="from-otel-blue to-otel-orange bg-gradient-to-r bg-clip-text text-transparent">
              {t("hero.titleSuffix")}
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto max-w-xl text-base leading-relaxed text-balance md:mx-0 md:text-lg">
            {t("hero.tagline")}
          </p>
        </div>

        {/* Compass with glow ring */}
        <div
          className="inline-flex flex-shrink-0 rounded-full p-4"
          style={{
            boxShadow: "0 0 60px hsl(var(--hero-accent-hsl) / 0.2)",
          }}
        >
          <Compass className="text-foreground h-32 w-32 md:h-40 md:w-40" />
        </div>
      </div>

      {/* Bottom fade transition */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-64"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background-hsl)) 0%, hsl(var(--background-hsl) / 0.6) 30%, transparent 100%)",
        }}
      />
    </section>
  );
}
