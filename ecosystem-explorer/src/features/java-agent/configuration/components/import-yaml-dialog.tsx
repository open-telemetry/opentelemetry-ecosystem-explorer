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
import { useState, useRef, type JSX } from "react";
import { Upload } from "lucide-react";
import { load as parseYaml } from "js-yaml";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";

const TRIGGER_CLASS =
  "border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

function validateYaml(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Paste a YAML configuration or upload a file before importing.";
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return `Invalid YAML syntax: ${detail}`;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "The YAML must be a key-value mapping at the top level, not a list or plain value.";
  }
  return null;
}

export function ImportYamlDialog(): JSX.Element {
  const { loadFromYaml } = useConfigurationBuilder();
  const [open, setOpen] = useState(false);
  const [yaml, setYaml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setYaml("");
    setError(null);
    setIsLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetState();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setYaml((ev.target?.result as string) ?? "");
      setError(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    const validationError = validateYaml(yaml);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await loadFromYaml(yaml.trim());
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import the YAML configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button type="button" className={TRIGGER_CLASS}>
          <Upload className="h-3 w-3" aria-hidden="true" />
          Import
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] w-[90vw] max-w-2xl flex-col gap-4">
        <header className="border-border/30 space-y-1 border-b pr-8 pb-3">
          <DialogTitle className="text-xl font-semibold">Import YAML Configuration</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Paste an existing OpenTelemetry Java Agent YAML configuration below, or upload a file.
            All recognised fields will be loaded into the form.
          </DialogDescription>
        </header>

        {error && (
          <p
            role="alert"
            id="import-yaml-error"
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="import-yaml-textarea" className="text-foreground text-xs font-medium">
              YAML content
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml,.txt"
                className="sr-only"
                tabIndex={-1}
                aria-label="Upload YAML file"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-border/60 text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                <Upload className="h-3 w-3" aria-hidden="true" />
                Upload file
              </button>
            </div>
          </div>
          <textarea
            id="import-yaml-textarea"
            value={yaml}
            onChange={(e) => {
              setYaml(e.target.value);
              if (error) setError(null);
            }}
            placeholder="# Paste your otel-config.yaml content here&#8230;"
            spellCheck={false}
            aria-invalid={error !== null}
            aria-describedby={error ? "import-yaml-error" : undefined}
            className="bg-background/60 border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:ring-primary/20 min-h-[240px] flex-1 resize-none rounded-md border p-3 font-mono text-xs focus:ring-2 focus:outline-none"
          />
        </div>

        <footer className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="border-border/60 bg-card text-foreground hover:bg-card/80 inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer items-center rounded-md px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Importing…" : "Import"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
