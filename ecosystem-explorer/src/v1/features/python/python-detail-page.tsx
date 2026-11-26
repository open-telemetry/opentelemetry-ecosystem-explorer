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

/*
 * PythonDetailPageV1 — a lightweight package page built only from what the python database
 * has: description, latest version, Python requirement, instrumented libraries, entry points,
 * metrics support, semantic-convention status and the release list.
 *
 * There is no telemetry, README or configuration section: the registry has no reliable
 * structured data for them yet, so they are left out rather than rendered empty.
 *
 * `?version=` selects a release. A version that is not one of the package's releases falls
 * back to the latest and says so.
 */

import { AlertCircle, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { SubNav } from "@/v1/components/layout/sub-nav";
import { SiblingNavigator, type SiblingItem } from "@/v1/components/detail/sibling-navigator";
import { VersionTimeline } from "@/v1/components/detail/version-timeline";

/** Groups libraries by the dependency group they came from, keeping the registry's order. */
function groupLibraries(libraries: PythonInstrumentedLibrary[]) {
  const groups = new Map<string, PythonInstrumentedLibrary[]>();
  for (const library of libraries) {
    groups.set(library.source_key, [...(groups.get(library.source_key) ?? []), library]);
  }
  return [...groups.entries()];
}

export function PythonDetailPageV1() {
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

  const crumbs = (last: string) => [
    { label: t("breadcrumb.explorer"), href: "/" },
    { label: t("breadcrumb.python") },
    { label: t("breadcrumb.instrumentation"), href: PYTHON_LIST_PATH },
    { label: last },
  ];

  const siblings: SiblingItem[] = useMemo(
    () =>
      (index?.packages ?? [])
        .map((p) => ({ id: p.name, name: p.name, displayName: p.name, href: detailPath(p.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [index]
  );

  const error = indexError ?? pkgError;
  if (error) {
    return (
      <div className="td-detail">
        <SubNav crumbs={crumbs(name)} />
        <div className="td-box td-box--light">
          <div className="td-box__container">
            <div className="td-empty" role="alert">
              <AlertCircle className="h-6 w-6" aria-hidden focusable="false" />
              <p className="td-empty__title">{t("detail.error.title")}</p>
              <p className="td-empty__lead">{error.message || t("detail.error.description")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (indexLoading || !index || (entry && resolved && (pkgLoading || !pkg))) {
    return (
      <div className="td-detail">
        <SubNav crumbs={crumbs(name)} />
        <div className="td-detail__loading" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{t("detail.loading")}</span>
        </div>
      </div>
    );
  }

  if (!entry || !resolved || !pkg) {
    return (
      <div className="td-detail">
        <SubNav crumbs={crumbs(name)} />
        <div className="td-box td-box--light">
          <div className="td-box__container">
            <div className="td-empty" role="alert">
              <AlertCircle className="h-6 w-6" aria-hidden focusable="false" />
              <p className="td-empty__title">{t("detail.notFound.title")}</p>
              <p className="td-empty__lead">{t("detail.notFound.description", { name })}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const latest = entry.releases[0].version;
  const description = pkg.description?.trim() || entry.description?.trim() || null;
  const source = sourceUrl(pkg);
  const metrics = metricsFacet(pkg.supports_metrics);
  const semconv = semconvFacet(pkg.semantic_convention_status);
  const instruments = pkg.instruments ?? [];
  const entryPoints = pkg.entry_points ?? [];
  const releaseHref = (version: string) =>
    version === latest
      ? detailPath(entry.name)
      : `${detailPath(entry.name)}?version=${encodeURIComponent(version)}`;
  const timeline = describeReleases(entry.releases).map((release) => ({
    version: release.version,
    summary: release.isLatest
      ? t("detail.releases.latestBadge")
      : release.sameAsLatest
        ? t("detail.releases.sameAsLatest")
        : undefined,
  }));

  return (
    <div className="td-detail">
      <SubNav crumbs={crumbs(entry.name)} />

      <div className="td-detail__layout td-box td-box--light">
        <aside className="td-detail__rail-left" aria-label={t("detail.railLabel")}>
          <SiblingNavigator title={t("detail.siblings")} items={siblings} activeId={entry.name} />
        </aside>

        <main className="td-detail__main">
          {resolved.invalid && (
            <div className="td-detail-notice" role="note">
              <AlertTriangle className="td-detail-notice__icon" aria-hidden />
              <div className="td-detail-notice__body">
                <p className="td-detail-notice__description">
                  {t("detail.invalidVersion", { version: searchParams.get("version"), latest })}
                </p>
              </div>
            </div>
          )}

          <header className="td-detail-header">
            <div className="td-detail-header__title-row">
              <h1 className="td-detail-header__title">{entry.name}</h1>
              <span className="td-pill td-pill--info">{resolved.version}</span>
            </div>
            {description && <p className="td-detail-header__description">{description}</p>}
            <div className="td-detail-header__signals">
              <span className="td-pill" data-metrics={metrics}>
                {t(`metrics.${metrics}`)}
              </span>
              {semconv !== "unknown" && (
                <span className="td-pill td-pill--info" data-semconv={semconv}>
                  {t(`semconv.${semconv}`, { defaultValue: semconv })}
                </span>
              )}
            </div>
            {source && (
              <div className="td-detail-header__actions">
                <a
                  className="td-btn td-btn--outline-regular"
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("detail.overview.sourceLink")}
                  <ExternalLink className="h-4 w-4" aria-hidden focusable="false" />
                </a>
              </div>
            )}
          </header>

          <section aria-labelledby="python-overview">
            <h2 id="python-overview">{t("detail.overview.title")}</h2>
            <dl>
              <dt>{t("detail.overview.version")}</dt>
              <dd>
                {resolved.version}
                {resolved.version === latest && ` (${t("detail.overview.latest")})`}
              </dd>
              <dt>{t("detail.overview.requiresPython")}</dt>
              <dd>{pkg.requires_python || t("detail.overview.notSpecified")}</dd>
              <dt>{t("metrics.label")}</dt>
              <dd>{t(`metrics.${metrics}`)}</dd>
              <dt>{t("semconv.label")}</dt>
              <dd>{t(`semconv.${semconv}`, { defaultValue: semconv })}</dd>
            </dl>
          </section>

          <section aria-labelledby="python-instruments">
            <h2 id="python-instruments">{t("detail.instruments.title")}</h2>
            <p>{t("detail.instruments.description")}</p>
            {instruments.length === 0 ? (
              <p>{t("detail.instruments.empty")}</p>
            ) : (
              groupLibraries(instruments).map(([sourceKey, libraries]) => (
                <div key={sourceKey}>
                  <h3>
                    {t(`detail.instruments.groups.${sourceKey}`, {
                      defaultValue: t("detail.instruments.groups.other"),
                    })}
                  </h3>
                  <div className="td-table-wrap">
                    <table className="td-table">
                      <thead>
                        <tr>
                          <th scope="col">{t("detail.instruments.library")}</th>
                          <th scope="col">{t("detail.instruments.versionRange")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {libraries.map((library, i) => (
                          <tr key={`${library.library}-${i}`} className="td-table__row">
                            <td>
                              <code>{library.library}</code>
                            </td>
                            <td>
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
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="python-entry-points">
            <h2 id="python-entry-points">{t("detail.entryPoints.title")}</h2>
            {entryPoints.length === 0 ? (
              <p>{t("detail.entryPoints.empty")}</p>
            ) : (
              <>
                <p>{t("detail.entryPoints.description")}</p>
                <div className="td-table-wrap">
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("detail.entryPoints.name")}</th>
                        <th scope="col">{t("detail.entryPoints.value")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryPoints.map((entryPoint, i) => (
                        <tr key={`${entryPoint.name}-${i}`} className="td-table__row">
                          <td>
                            <code>{entryPoint.name}</code>
                          </td>
                          <td>
                            <code>{entryPoint.value}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>

        <aside className="td-detail__rail-right" aria-label={t("detail.rightRailLabel")}>
          <VersionTimeline
            versions={timeline}
            currentVersion={resolved.version}
            buildHref={releaseHref}
          />
        </aside>
      </div>
    </div>
  );
}
