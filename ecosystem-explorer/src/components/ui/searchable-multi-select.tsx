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
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

interface SearchableMultiSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export function SearchableMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  className = "",
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative space-y-2 ${className}`} ref={containerRef}>
      <label className="text-muted-foreground text-sm font-medium">{label}</label>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`border-border/60 bg-background/80 hover:border-primary/50 focus-within:ring-primary/20 flex min-h-[42px] cursor-pointer items-center justify-between rounded-lg border px-4 py-2 text-sm backdrop-blur-sm transition-all duration-200 focus-within:ring-2 ${
          isOpen ? "border-primary/50 ring-primary/20 ring-2" : ""
        }`}
      >
        <span className={selected.length === 0 ? "text-muted-foreground/50" : "text-foreground"}>
          {selected.length === 0 ? placeholder : `${selected.length} selected`}
        </span>
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {isOpen && (
        <div className="border-border/60 bg-background/95 ring-border/5 absolute z-[100] mt-1 w-full rounded-lg border shadow-xl ring-1 backdrop-blur-md">
          <div className="border-border/50 border-b p-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="bg-muted/50 focus:bg-muted w-full rounded-md py-1.5 pr-3 pl-9 text-sm transition-colors focus:outline-none"
              />
            </div>
          </div>

          <div
            className="custom-scrollbar max-h-[240px] overflow-y-auto p-1"
            onWheel={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {filteredOptions.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-sm">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  onClick={() => toggleOption(option)}
                  className={`hover:bg-primary/10 flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                    selected.includes(option)
                      ? "bg-primary/5 text-primary font-medium"
                      : "text-foreground"
                  }`}
                >
                  <span>{option}</span>
                  {selected.includes(option) && <Check className="h-4 w-4" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SelectedChips({
  selected,
  onRemove,
  className = "",
}: {
  selected: string[];
  onRemove: (item: string) => void;
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
          {item}
          <button
            onClick={() => onRemove(item)}
            className="hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
