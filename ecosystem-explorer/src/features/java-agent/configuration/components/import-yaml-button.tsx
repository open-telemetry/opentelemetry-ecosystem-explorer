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
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";

export function ImportYamlButton() {
  const { loadFromYaml } = useConfigurationBuilder();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedYaml, setPastedYaml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const openDialog = () => {
    setPastedYaml("");
    setError(null);
    dialogRef.current?.showModal();
  };

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setPastedYaml("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Close on backdrop click
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const clickedOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (clickedOutside) closeDialog();
    };
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [closeDialog]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setPastedYaml(text);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleLoad = async () => {
    const yaml = pastedYaml.trim();
    if (!yaml) {
      setError("Please provide a YAML configuration to import.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await loadFromYaml(yaml);
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse YAML configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  const buttonClass =
    "border-border/60 bg-card text-foreground hover:bg-card/80 focus-visible:ring-primary inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    <>
      <button type="button" onClick={openDialog} className={buttonClass}>
        <Upload className="h-3 w-3" aria-hidden="true" />
        Import
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="import-yaml-title"
        aria-describedby="import-yaml-desc"
        className="bg-card text-foreground border-border/50 w-full max-w-lg rounded-xl border p-0 shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 id="import-yaml-title" className="text-base font-semibold">
              Import YAML Configuration
            </h2>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close import dialog"
              className="text-muted-foreground hover:text-foreground rounded-md p-1"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p id="import-yaml-desc" className="text-muted-foreground text-sm">
            Load an existing OpenTelemetry Java Agent configuration into the builder. Choose a file
            from your machine or paste the YAML directly below.
          </p>

          <div className="space-y-1">
            <label htmlFor="import-yaml-file" className="text-sm font-medium">
              Choose a YAML file
            </label>
            <input
              ref={fileInputRef}
              id="import-yaml-file"
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileChange}
              className="border-border/60 text-foreground bg-background/80 file:bg-card file:text-foreground file:border-border/60 w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border file:px-2 file:py-0.5 file:text-xs"
            />
          </div>

          <div className="relative flex items-center gap-3">
            <span className="bg-border/60 h-px flex-1" aria-hidden="true" />
            <span className="text-muted-foreground text-xs">or paste below</span>
            <span className="bg-border/60 h-px flex-1" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <label htmlFor="import-yaml-paste" className="text-sm font-medium">
              Paste YAML
            </label>
            <textarea
              id="import-yaml-paste"
              value={pastedYaml}
              onChange={(e) => {
                setPastedYaml(e.target.value);
                setError(null);
              }}
              placeholder="file_format: '0.3'&#10;sdk:&#10;  ..."
              rows={10}
              className="border-border/60 bg-background/80 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 w-full rounded-lg border px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none"
              aria-invalid={error !== null}
              aria-describedby={error ? "import-yaml-error" : undefined}
            />
          </div>

          {error && (
            <p id="import-yaml-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="border-border/60 bg-card text-foreground hover:bg-card/80 rounded-md border px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLoad}
              disabled={isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Load Configuration"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
