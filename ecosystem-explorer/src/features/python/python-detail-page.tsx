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
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Seo } from "@/components/seo/seo";
import { BackButton } from "@/components/ui/back-button";
import { Loader } from "@/components/ui/loader";
import { PageContainer } from "@/components/layout/page-container";
import { usePythonIndex, usePythonPackage } from "@/hooks/use-python-data";
import {
  PYTHON_LIST_PATH,
  describeReleases,
  detailPath,
  metricsFacet,
  resolveVersion,
  semconvFacet,
  sourceUrl,
} from "@/features/python/utils/catalogue";
import type { PythonInstrumentedLibrary } from "@/types/python";
import { MetricsBadge, SemconvBadge } from "./components/python-badges";

const SECTION = "border-border/60 bg-surface-card shadow-surface space-y-4 rounded-lg border p-6";
const SECTION_TITLE = "text-foreground text-xl font-semibold";

/** Groups libraries by the dependency group they came from, keeping the registry's order. */
function groupLibraries(libraries: PythonInstrumentedLibrary[]) {
  const groups = new Map<string, PythonInstrumentedLibrary[]>();
  for (const library of libraries) {
    groups.set(library.source_key, [...(groups.get(library.source_key) ?? []), library]);
  }
  return [...groups.entries()];
}

export function PythonDetailPage() {
  const { t } = useTranslation("python");
  const { name = "" } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const { data: index, loading: indexLoading, error: indexError } = usePythonIndex();

  const entry = useMemo(() => index?.packages.find((p) => p.name === name), [index, name]);
  const resolved = useMemo(
    () => (entry ? resolveVersion(entry.releases, searchParams.get("version")) : null),
    [entry, searchParams]
  );
  // An empty name makes the hook skip loading until the index has resolved the package.
  const {
    data: pkg,
    loading: pkgLoading,
    error: pkgError,
  } = usePythonPackage(entry && resolved ? entry.name : "", resolved?.version);

  const listPath = PYTHON_LIST_PATH;
  const back = <BackButton fallbackTo={listPath} label={t("detail.back")} />;

  if (indexError || pkgError) {
    const message = (indexError ?? pkgError)?.message;
    return (
      <PageContainer>
        <div className="space-y-4">
          {back}
          <div
            role="alert"
            className="flex flex-col items-center justify-center space-y-4 py-32 text-center text-red-500"
          >
            <AlertCircle className="mx-auto h-12 w-12 opacity-50" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{t("detail.error.title")}</h1>
            {message && <p className="text-muted-foreground text-sm">{message}</p>}
            <p className="text-muted-foreground">{t("detail.error.description")}</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (indexLoading || !index) {
    return (
      <PageContainer>
        <div className="space-y-4">
          {back}
          <Loader label={t("detail.loading")} />
        </div>
      </PageContainer>
    );
  }

  if (!entry || !resolved) {
    return (
      <PageContainer>
        <div className="space-y-4">
          {back}
          <div role="alert" className="space-y-2 py-24 text-center">
            <h1 className="text-foreground text-2xl font-semibold">{t("detail.notFound.title")}</h1>
            <p className="text-muted-foreground">{t("detail.notFound.description", { name })}</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (pkgLoading || !pkg) {
    return (
      <PageContainer>
        <div className="space-y-4">
          {back}
          <Loader label={t("detail.loading")} />
        </div>
      </PageContainer>
    );
  }

  const latest = entry.releases[0].version;
  const description = pkg.description?.trim() || entry.description?.trim() || null;
  const source = sourceUrl(pkg);
  const metrics = metricsFacet(pkg.supports_metrics);
  const semconv = semconvFacet(pkg.semantic_convention_status);
  const instruments = pkg.instruments ?? [];
  const entryPoints = pkg.entry_points ?? [];
  const releases = describeReleases(entry.releases);
  const releaseHref = (version: string) =>
    version === latest
      ? detailPath(entry.name)
      : `${detailPath(entry.name)}?version=${encodeURIComponent(version)}`;

  return (
    <PageContainer>
      <Seo
        title={`${entry.name} — Python instrumentation`}
        description={description ?? undefined}
      />
      <div className="space-y-6">
        {back}

        {resolved.invalid && (
          <div
            role="status"
            className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400"
          >
            {t("detail.invalidVersion", { version: searchParams.get("version"), latest })}
          </div>
        )}

        <header className="space-y-3">
          <h1 className="text-3xl font-bold break-words md:text-4xl">
            <span className="text-gradient-brand">{entry.name}</span>
          </h1>
          {description && <p className="text-muted-foreground text-base">{description}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <MetricsBadge metrics={metrics} />
            <SemconvBadge semconv={semconv} />
          </div>
        </header>

        <section aria-labelledby="python-overview" className={SECTION}>
          <h2 id="python-overview" className={SECTION_TITLE}>
            {t("detail.overview.title")}
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("detail.overview.version")}</dt>
              <dd className="text-foreground font-medium">
                {resolved.version}
                {resolved.version === latest && (
                  <span className="text-primary ml-2 text-xs">{t("detail.overview.latest")}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("detail.overview.requiresPython")}</dt>
              <dd className="text-foreground font-medium">
                {pkg.requires_python || t("detail.overview.notSpecified")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("metrics.label")}</dt>
              <dd className="text-foreground font-medium">{t(`metrics.${metrics}`)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("semconv.label")}</dt>
              <dd className="text-foreground font-medium">
                {t(`semconv.${semconv}`, { defaultValue: semconv })}
              </dd>
            </div>
            {source && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t("detail.overview.source")}</dt>
                <dd>
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {t("detail.overview.sourceLink")}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section aria-labelledby="python-instruments" className={SECTION}>
          <h2 id="python-instruments" className={SECTION_TITLE}>
            {t("detail.instruments.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("detail.instruments.description")}</p>
          {instruments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("detail.instruments.empty")}</p>
          ) : (
            groupLibraries(instruments).map(([sourceKey, libraries]) => (
              <div key={sourceKey} className="space-y-2">
                <h3 className="text-foreground text-sm font-semibold">
                  {t(`detail.instruments.groups.${sourceKey}`, {
                    defaultValue: t("detail.instruments.groups.other"),
                  })}
                </h3>
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-1 pr-4 font-medium">
                        {t("detail.instruments.library")}
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        {t("detail.instruments.versionRange")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {libraries.map((library, i) => (
                      <tr key={`${library.library}-${i}`} className="border-border/40 border-t">
                        <td className="py-2 pr-4">
                          <code>{library.library}</code>
                        </td>
                        <td className="py-2">
                          {library.version_range ? (
                            <code>{library.version_range}</code>
                          ) : (
                            t("detail.overview.notSpecified")
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="python-entry-points" className={SECTION}>
          <h2 id="python-entry-points" className={SECTION_TITLE}>
            {t("detail.entryPoints.title")}
          </h2>
          {entryPoints.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("detail.entryPoints.empty")}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{t("detail.entryPoints.description")}</p>
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      {t("detail.entryPoints.name")}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t("detail.entryPoints.value")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entryPoints.map((entryPoint, i) => (
                    <tr key={`${entryPoint.name}-${i}`} className="border-border/40 border-t">
                      <td className="py-2 pr-4">
                        <code>{entryPoint.name}</code>
                      </td>
                      <td className="py-2 break-all">
                        <code>{entryPoint.value}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section aria-labelledby="python-releases" className={SECTION}>
          <h2 id="python-releases" className={SECTION_TITLE}>
            {t("detail.releases.title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("detail.releases.description")}</p>
          <ul className="space-y-2">
            {releases.map((release) => {
              const current = release.version === resolved.version;
              return (
                <li key={release.version} className="flex flex-wrap items-center gap-3 text-sm">
                  <Link
                    to={releaseHref(release.version)}
                    aria-current={current ? "true" : undefined}
                    aria-label={t("detail.releases.view", { version: release.version })}
                    className={
                      current ? "text-primary font-semibold" : "text-foreground hover:underline"
                    }
                  >
                    {release.version}
                  </Link>
                  {release.isLatest && (
                    <span className="text-primary text-xs">{t("detail.releases.latestBadge")}</span>
                  )}
                  {release.sameAsLatest && (
                    <span className="text-muted-foreground text-xs">
                      {t("detail.releases.sameAsLatest")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}
