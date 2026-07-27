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
 * CollectorDiffPageV1 — Phase 5 diff route. Reads `from` and `to` versions
 * from the URL query, fetches both component snapshots, and runs the
 * `diffSchemas` engine against their (currently absent) config keys.
 *
 * The registry does not yet expose per-version config schemas, so the
 * configuration-schema section renders a designed empty state. The metadata
 * diff — stability transitions per signal, added/removed signals, and
 * description changes — is live and compares the two fetched snapshots. When
 * per-version config schemas land in the data layer, only the `extractKeys()`
 * helper needs to grow.
 */

import { ArrowRight, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import { useCollectorComponent, useComponentVersions } from "@/hooks/use-collector-data";
import type { CollectorComponent } from "@/types/collector";
import { SubNav } from "@/v1/components/layout/sub-nav";
import { diffSchemas, type SchemaKey } from "@/v1/lib/schema-diff";

function extractKeys(): SchemaKey[] {
  // Per-version config schemas are not yet exposed by `ecosystem-registry`.
  // When they are, accept the component as input and return its `properties`
  // here. For now the diff view falls back to a metadata-only diff (see
  // below) so users at least see what *did* change between the two versions.
  return [];
}

interface MetadataDelta {
  /**
   * The component's declared stability levels (alpha, beta, stable…), not the
   * signals those levels cover — `signalsAdded`/`signalsRemoved` carry those.
   */
  stabilityLevelsChanged?: { from: string[]; to: string[] };
  descriptionChanged?: { from: string; to: string };
  signalsAdded: string[];
  signalsRemoved: string[];
}

function metadataDiff(a: CollectorComponent, b: CollectorComponent): MetadataDelta {
  const out: MetadataDelta = { signalsAdded: [], signalsRemoved: [] };
  const aLevels = Object.keys(a.status?.stability ?? {}).sort();
  const bLevels = Object.keys(b.status?.stability ?? {}).sort();
  // Joined only to compare. The joined form is an internal encoding and must
  // never reach the page — callers format the arrays as a readable list.
  if (aLevels.join("|") !== bLevels.join("|")) {
    out.stabilityLevelsChanged = { from: aLevels, to: bLevels };
  }
  if ((a.description ?? "") !== (b.description ?? "")) {
    out.descriptionChanged = { from: a.description ?? "", to: b.description ?? "" };
  }
  const aSig = new Set(Object.values(a.status?.stability ?? {}).flat());
  const bSig = new Set(Object.values(b.status?.stability ?? {}).flat());
  for (const s of bSig) if (!aSig.has(s)) out.signalsAdded.push(s);
  for (const s of aSig) if (!bSig.has(s)) out.signalsRemoved.push(s);
  out.signalsAdded.sort();
  out.signalsRemoved.sort();
  return out;
}

/** Renders a stability-level set as display copy, never as the joined key. */
function formatLevels(levels: string[], t: TFunction<"detail">): string {
  return levels.length > 0 ? levels.join(", ") : t("diff.stabilityNone");
}

/** True when the two snapshots differ in any way this view surfaces. */
function hasMetadataChanges(delta: MetadataDelta): boolean {
  return Boolean(
    delta.stabilityLevelsChanged ||
    delta.descriptionChanged ||
    delta.signalsAdded.length > 0 ||
    delta.signalsRemoved.length > 0
  );
}

export function CollectorDiffPageV1() {
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("collector");
  const { distribution, name } = useParams<{ distribution: string; name: string }>();
  const [params] = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const paramsValid = Boolean(from && to);

  const fromQ = useCollectorComponent(distribution ?? "", name ?? "", from);
  const toQ = useCollectorComponent(distribution ?? "", name ?? "", to);
  const versionsQ = useComponentVersions(distribution ?? "", name ?? "");
  const loading = fromQ.loading || toQ.loading;
  const error = fromQ.error ?? toQ.error;

  // `from` and `to` are user-editable and few components span every release,
  // so "that release doesn't have this component" is the ordinary way this URL
  // fails. Name the offending release rather than reporting a generic error.
  const released = versionsQ.data;
  const missingVersions = released ? [from, to].filter((v) => !released.includes(v)) : [];
  const classifying = Boolean(error) && versionsQ.loading;

  const schemaDelta = useMemo(() => {
    if (!fromQ.data || !toQ.data) return null;
    return diffSchemas(extractKeys(), extractKeys());
  }, [fromQ.data, toQ.data]);

  const metaDelta = useMemo(() => {
    if (!fromQ.data || !toQ.data) return null;
    return metadataDiff(fromQ.data, toQ.data);
  }, [fromQ.data, toQ.data]);

  return (
    <div className="td-diff">
      <SubNav
        crumbs={[
          { label: t("breadcrumbs.explorer"), href: "/" },
          { label: tc("header.title"), href: "/collector" },
          { label: t("breadcrumbs.components"), href: "/collector/components" },
          {
            label: name ?? t("diff.componentFallback"),
            href: `/collector/components/${distribution}/${name}`,
          },
          { label: t("diff.breadcrumbLabel") },
        ]}
      />
      <div className="td-box td-box--light">
        <div className="td-box__container">
          <header className="td-diff__header">
            <h1 className="td-diff__title">
              {/* One key, not a verb concatenated onto a <code> span: languages
                  order the component name and the verb differently. */}
              <Trans
                i18nKey="diff.heading"
                ns="detail"
                values={{ name: name ?? t("diff.componentFallback") }}
                components={{ name: <code /> }}
              />
            </h1>
            <p className="td-diff__versions">
              <strong>{from || "—"}</strong>
              <ArrowRight className="h-4 w-4" aria-hidden focusable="false" />
              <strong>{to || "—"}</strong>
            </p>
          </header>

          {!paramsValid && (
            <div role="alert" className="td-empty">
              <p className="td-empty__title">{t("diff.invalidTitle")}</p>
              <p className="td-empty__lead">{t("diff.invalidLead")}</p>
            </div>
          )}

          {paramsValid && (loading || classifying) && (
            <div className="td-detail__loading" role="status" aria-live="polite">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden focusable="false" />
              <span>{t("diff.loading")}</span>
            </div>
          )}

          {paramsValid && !loading && !classifying && missingVersions.length > 0 && (
            <div role="alert" className="td-empty">
              <p className="td-empty__title">{t("diff.notReleasedTitle")}</p>
              <p className="td-empty__lead">
                {t("diff.notReleasedLead", {
                  component: name,
                  versions: missingVersions.join(", "),
                  count: missingVersions.length,
                })}
              </p>
            </div>
          )}

          {paramsValid && !loading && !classifying && error && missingVersions.length === 0 && (
            <div role="alert" className="td-empty">
              <p className="td-empty__title">{t("diff.errorTitle")}</p>
              <p className="td-empty__lead">{t("diff.errorLead")}</p>
            </div>
          )}

          {paramsValid && !loading && !error && schemaDelta && metaDelta && (
            <div className="td-diff__sections">
              {/* Schema diff (currently always empty until the registry exposes schemas). */}
              <section className="td-diff-section">
                <h2 className="td-diff-section__title">{t("diff.configTitle")}</h2>
                {schemaDelta.added.length === 0 &&
                schemaDelta.removed.length === 0 &&
                schemaDelta.renamed.length === 0 &&
                schemaDelta.typeChanged.length === 0 ? (
                  <p className="td-diff-section__empty">{t("diff.configEmpty")}</p>
                ) : (
                  <DiffBuckets delta={schemaDelta} />
                )}
              </section>

              {/* Metadata diff is what we can show today. */}
              <section className="td-diff-section">
                <h2 className="td-diff-section__title">{t("diff.metadataTitle")}</h2>
                <ul className="td-diff-section__list">
                  {metaDelta.stabilityLevelsChanged && (
                    <li>
                      <Trans
                        i18nKey="diff.stabilityLevelsChanged"
                        ns="detail"
                        values={{
                          from: formatLevels(metaDelta.stabilityLevelsChanged.from, t),
                          to: formatLevels(metaDelta.stabilityLevelsChanged.to, t),
                        }}
                        components={{ label: <strong /> }}
                      />
                    </li>
                  )}
                  {metaDelta.signalsAdded.map((s) => (
                    <li key={`add-${s}`} className="td-diff-section__add">
                      {t("diff.signalAdded", { signal: s })}
                    </li>
                  ))}
                  {metaDelta.signalsRemoved.map((s) => (
                    <li key={`rem-${s}`} className="td-diff-section__remove">
                      {t("diff.signalRemoved", { signal: s })}
                    </li>
                  ))}
                  {metaDelta.descriptionChanged && <li>{t("diff.descriptionChanged")}</li>}
                  {!hasMetadataChanges(metaDelta) && <li>{t("diff.noMetadataChanges")}</li>}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffBuckets({ delta }: { delta: ReturnType<typeof diffSchemas> }) {
  const { t } = useTranslation("detail");
  return (
    <div className="td-diff-buckets">
      <DiffBucket title={t("diff.buckets.added")} className="td-diff-bucket--add">
        {delta.added.map((k) => (
          <li key={k.key}>
            <code>{k.key}</code> {k.type && <span className="td-diff-bucket__type">{k.type}</span>}
          </li>
        ))}
      </DiffBucket>
      <DiffBucket title={t("diff.buckets.removed")} className="td-diff-bucket--remove">
        {delta.removed.map((k) => (
          <li key={k.key}>
            <code>{k.key}</code>
          </li>
        ))}
      </DiffBucket>
      <DiffBucket title={t("diff.buckets.renamed")} className="td-diff-bucket--rename">
        {delta.renamed.map((r) => (
          <li key={`${r.from.key}->${r.to.key}`}>
            <code>{r.from.key}</code> → <code>{r.to.key}</code>
          </li>
        ))}
      </DiffBucket>
      <DiffBucket title={t("diff.buckets.typeChanged")} className="td-diff-bucket--type">
        {delta.typeChanged.map((tc) => (
          <li key={tc.key}>
            <code>{tc.key}</code> : {tc.fromType} → {tc.toType}
          </li>
        ))}
      </DiffBucket>
    </div>
  );
}

function DiffBucket({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  // `children` is an array of <li>; we skip rendering if empty.
  const arr = Array.isArray(children) ? children : [children];
  if (arr.length === 0) return null;
  return (
    <div className={`td-diff-bucket ${className ?? ""}`}>
      <h3 className="td-diff-bucket__title">{title}</h3>
      <ul className="td-diff-bucket__list">{children}</ul>
    </div>
  );
}
