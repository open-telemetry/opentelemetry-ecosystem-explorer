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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ModuleChangeStatus = "added" | "changed" | "removed";

const STATUS_OPTIONS: ModuleChangeStatus[] = ["added", "changed", "removed"];

interface ModuleStatusFilterProps {
  value: ModuleChangeStatus | "";
  onChange: (value: ModuleChangeStatus | "") => void;
}

export function ModuleStatusFilter({ value, onChange }: ModuleStatusFilterProps) {
  const { t } = useTranslation("java-agent");

  const currentLabel = value === "" ? t("filter.status.all") : t(`filter.status.${value}`);

  const itemClassName = (isActive: boolean) =>
    `data-[highlighted]:bg-primary/10 hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors outline-none select-none ${
      isActive ? "bg-primary/5 text-primary font-medium" : "text-foreground"
    }`;

  return (
    <div className="flex items-center gap-2">
      <span
        id="module-status-filter-label"
        className="text-muted-foreground text-sm font-medium whitespace-nowrap"
      >
        {t("filter.status.label")}
      </span>
      <span id="module-status-filter-value" className="sr-only">
        {currentLabel}
      </span>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-labelledby="module-status-filter-label"
          aria-describedby="module-status-filter-value"
          className="border-border/60 bg-card text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 flex cursor-pointer items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition-all duration-200 focus:ring-2 focus:outline-none"
        >
          <span>{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="border-border/60 bg-background/95 ring-border/5 z-[100] min-w-[8rem] overflow-hidden rounded-lg border p-1 shadow-xl ring-1 backdrop-blur-md"
          >
            <DropdownMenu.Item
              className={itemClassName(value === "")}
              onSelect={() => onChange("")}
            >
              <span>{t("filter.status.all")}</span>
              {value === "" && <Check className="h-4 w-4" aria-hidden="true" />}
            </DropdownMenu.Item>
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenu.Item
                key={status}
                className={itemClassName(value === status)}
                onSelect={() => onChange(status)}
              >
                <span>{t(`filter.status.${status}`)}</span>
                {value === status && <Check className="h-4 w-4" aria-hidden="true" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
