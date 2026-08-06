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
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConfigurationTarget } from "@/lib/yaml-generator";

interface TargetSelectorProps {
  value: ConfigurationTarget;
  onChange: (value: ConfigurationTarget) => void;
  id?: string;
}

export function TargetSelector({ value, onChange, id = "target-select" }: TargetSelectorProps) {
  const { t } = useTranslation("java-agent");
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-muted-foreground text-sm font-medium whitespace-nowrap">
        {t("builder.sections.target")}
      </label>
      <div className="relative min-w-fit">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as ConfigurationTarget)}
          className="border-border/60 bg-card text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 cursor-pointer appearance-none rounded-md border px-3 py-2 pr-7 text-sm font-medium shadow-sm transition-all duration-200 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="javaagent">{t("builder.target.javaagent")}</option>
          <option value="spring_starter">{t("builder.target.springStarter")}</option>
        </select>
        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
