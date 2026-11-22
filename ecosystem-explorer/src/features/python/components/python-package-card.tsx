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
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PythonRow } from "@/features/python/utils/catalogue";
import { MetricsBadge, SemconvBadge } from "./python-badges";

export function PythonPackageCard({ row }: { row: PythonRow }) {
  const { t } = useTranslation("python");

  return (
    <Link
      to={row.href}
      aria-label={t("list.card.viewAria", { name: row.name })}
      className="group border-border bg-surface-card shadow-surface hover:border-secondary/40 hover:bg-card-secondary relative flex h-full flex-col gap-4 overflow-hidden rounded-lg border p-6 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-foreground group-hover:text-primary flex-1 text-lg leading-tight font-bold break-words transition-colors">
          {row.name}
        </h3>
        <span className="text-muted-foreground shrink-0 text-xs">
          {t("list.card.latest", { version: row.version })}
        </span>
      </div>

      {row.description && (
        <p className="text-muted-foreground line-clamp-3 text-sm">{row.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <MetricsBadge metrics={row.metrics} />
        <SemconvBadge semconv={row.semconv} />
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{t("list.card.releases", { count: row.releaseCount })}</span>
        <ArrowRight
          className="text-primary h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
