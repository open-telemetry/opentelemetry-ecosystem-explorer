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
import { useState } from "react";
import { useConfigurationBuilder } from "../hooks/use-configuration-builder";
import { generateYamlFile } from "../utils/yaml-generator";

export function ExportToolbar() {
  const { state } = useConfigurationBuilder();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const output = generateYamlFile(state);
  const fileExtension = ".yaml";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otel-config${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const disabled = state.selectedInstrumentations.size === 0;

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCopy}
        disabled={disabled}
        className="px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Copy configuration to clipboard"
      >
        {copyStatus === "copied" ? "Copied!" : "Copy"}
      </button>
      <button
        onClick={handleDownload}
        disabled={disabled}
        className="px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Download configuration file"
      >
        Download
      </button>
    </div>
  );
}
