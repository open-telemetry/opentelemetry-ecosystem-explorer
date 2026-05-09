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
import { useState, useId, type ReactNode } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";

interface SearchableMultiSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  renderOption?: (option: string) => ReactNode;
  className?: string;
}

export function SearchableMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  renderOption,
  className = "",
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = useId();

  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  return (
    <div className={`relative space-y-2 ${className}`}>
      <label htmlFor={triggerId} className="text-muted-foreground text-sm font-medium">
        {label}
      </label>

      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={triggerId}
            className={`border-border/60 bg-background/80 hover:border-primary/50 focus:ring-primary/20 flex min-h-[42px] w-full cursor-pointer items-center justify-between rounded-lg border px-4 py-2 text-left text-sm backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none ${
              isOpen ? "border-primary/50 ring-primary/20 ring-2" : ""
            }`}
          >
            <span
              className={selected.length === 0 ? "text-muted-foreground/50" : "text-foreground"}
            >
              {selected.length === 0 ? placeholder : `${selected.length} selected`}
            </span>
            <ChevronDown
              className={`text-muted-foreground h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            className="border-border/60 bg-background/95 ring-border/5 z-[100] mt-1 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border shadow-xl ring-1 backdrop-blur-md"
          >
            <Command className="flex w-full flex-col overflow-hidden bg-transparent">
              <div className="border-border/50 border-b p-2">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Command.Input
                    placeholder="Search..."
                    className="bg-muted/50 focus:bg-muted w-full rounded-md py-1.5 pr-3 pl-9 text-sm transition-colors focus:outline-none"
                  />
                </div>
              </div>

              <Command.List className="custom-scrollbar max-h-[240px] overflow-y-auto p-1">
                <Command.Empty className="text-muted-foreground py-4 text-center text-sm">
                  No options found
                </Command.Empty>
                <Command.Group>
                  {options.map((option) => (
                    <Command.Item
                      key={option}
                      value={option}
                      onSelect={() => toggleOption(option)}
                      className={`hover:bg-primary/10 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors outline-none ${
                        selected.includes(option)
                          ? "bg-primary/5 text-primary font-medium"
                          : "text-foreground"
                      }`}
                    >
                      <span>{renderOption ? renderOption(option) : option}</span>
                      {selected.includes(option) && <Check className="h-4 w-4" />}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export function SelectedChips({
  selected,
  onRemove,
  renderItem,
  className = "",
}: {
  selected: string[];
  onRemove: (item: string) => void;
  renderItem?: (item: string) => ReactNode;
  className?: string;
}) {
  if (selected.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {selected.map((item) => (
        <span
          key={item}
          className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm transition-all"
        >
          {renderItem ? renderItem(item) : item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item}`}
            className="hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
