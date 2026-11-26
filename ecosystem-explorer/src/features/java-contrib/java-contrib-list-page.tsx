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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, Search } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { BackButton } from "@/components/ui/back-button";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import {
  COMPONENT_TYPES,
  CONTRIB_STABILITIES,
  DISTRIBUTIONS,
  type DistributionName,
} from "@/types/java-contrib";
import { useContribComponents } from "./hooks/use-java-contrib";
import { EMPTY_FILTERS, filterContribEntries, type ContribFilters } from "./utils/filter";
import { ContribCard } from "./components/contrib-card";

const PILL_BASE =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:ring-primary focus:ring-2 focus:outline-none";
const PILL_ACTIVE = "border-secondary/60 bg-secondary/15 text-secondary";
const PILL_INACTIVE =
  "border-border text-muted-foreground hover:border-secondary/40 hover:text-foreground";

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function JavaContribListPage() {
  const { t } = useTranslation("java-agent");
  const { data, loading, error } = useContribComponents();
  const [filters, setFilters] = useState<ContribFilters>(EMPTY_FILTERS);
  const { query, types, stabilities, javaVersion, distribution } = filters;
  const update = (patch: Partial<ContribFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const entries = useMemo(() => data ?? [], [data]);
  const javaVersions = useMemo(
    () =>
      [...new Set(entries.map((e) => e.component.min_java_version).filter(Boolean))].sort(
        (a, b) => a - b
      ),
    [entries]
  );
  const filtered = useMemo(() => filterContribEntries(entries, filters), [entries, filters]);

  return (
    <PageContainer>
      <Seo />
      <BackButton />

      <div className="mt-3 space-y-6">
        <header className="border-border/60 bg-card/80 relative overflow-hidden rounded-lg border p-5 sm:p-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, hsl(var(--primary-hsl) / 0.06) 0%, hsl(var(--secondary-hsl) / 0.03) 40%, transparent 70%)",
            }}
          />
          <div className="relative z-10 space-y-2">
            <h1 className="text-2xl leading-tight font-bold sm:text-3xl md:text-4xl">
              <span className="text-gradient-brand">{t("contrib.list.title")}</span>
            </h1>
            <p className="text-muted-foreground max-w-4xl text-base leading-relaxed">
              {t("contrib.list.description")}
            </p>
          </div>
        </header>

        <div className="border-border/60 bg-card/80 relative space-y-5 rounded-lg border p-4 sm:p-6">
          <div className="relative max-w-xl">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label={t("contrib.list.search.ariaLabel")}
              placeholder={t("contrib.list.search.placeholder")}
              value={query}
              onChange={(e) => update({ query: e.target.value })}
              className="border-border bg-background focus:border-primary focus:ring-primary w-full rounded-md border py-2 pr-4 pl-10 text-sm focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:gap-8">
            <fieldset className="space-y-2">
              <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {t("contrib.list.filters.componentType")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {COMPONENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={types.includes(type)}
                    onClick={() => update({ types: toggle(types, type) })}
                    className={`${PILL_BASE} ${types.includes(type) ? PILL_ACTIVE : PILL_INACTIVE}`}
                  >
                    {t(`contrib.componentType.${type}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {t("contrib.list.filters.stability")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {CONTRIB_STABILITIES.map((stability) => (
                  <button
                    key={stability}
                    type="button"
                    aria-pressed={stabilities.includes(stability)}
                    onClick={() => update({ stabilities: toggle(stabilities, stability) })}
                    className={`${PILL_BASE} ${stabilities.includes(stability) ? PILL_ACTIVE : PILL_INACTIVE}`}
                  >
                    {t(`stability.${stability}`, { ns: "common" })}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {t("contrib.list.filters.distribution")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DISTRIBUTIONS) as DistributionName[]).map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={distribution === name}
                    onClick={() => update({ distribution: distribution === name ? null : name })}
                    className={`${PILL_BASE} ${distribution === name ? PILL_ACTIVE : PILL_INACTIVE}`}
                  >
                    {t(`contrib.distribution.${name}.filter`)}
                  </button>
                ))}
              </div>
            </fieldset>

            {javaVersions.length > 0 && (
              <div className="space-y-2">
                <label
                  htmlFor="contrib-java-version"
                  className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase"
                >
                  {t("contrib.list.filters.javaVersion")}
                </label>
                <select
                  id="contrib-java-version"
                  value={javaVersion ?? ""}
                  onChange={(e) =>
                    update({ javaVersion: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                >
                  <option value="">{t("contrib.list.filters.anyJava")}</option>
                  {javaVersions.map((v) => (
                    <option key={v} value={v}>
                      {t("contrib.list.filters.runsOnJava", { version: v })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="text-muted-foreground text-sm" aria-live="polite">
            {loading
              ? t("contrib.list.loading")
              : error
                ? t("contrib.list.error")
                : t("contrib.list.found", { count: filtered.length })}
          </div>

          {loading ? (
            <Loader label={t("contrib.list.loading")} />
          ) : error ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
              <div className="mx-auto max-w-md px-4 text-center">
                <Package className="text-destructive/50 mx-auto h-12 w-12" aria-hidden="true" />
                <p className="text-muted-foreground mt-4 text-sm font-medium">{error.message}</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground text-sm font-medium">{t("contrib.list.empty")}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((entry) => (
                <ContribCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
