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
import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  onCopy?: () => void;
}

const COPIED_FLASH_MS = 2000;

const DEFAULT_CLASS =
  "border-border/60 bg-card text-foreground hover:bg-card/80 inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className,
  onCopy,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (!navigator.clipboard?.writeText) return; // Clipboard API not supported, stay silent.
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        onCopy?.();
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
          timeoutRef.current = null;
        }, COPIED_FLASH_MS);
      },
      () => {
        // Clipboard write rejected (permissions, insecure context). Stay silent.
      }
    );
  };

  const visibleLabel = copied ? copiedLabel : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={visibleLabel}
      className={className ?? DEFAULT_CLASS}
    >
      <Copy className="pointer-events-none h-3 w-3" aria-hidden="true" />
      <span aria-live="polite">{visibleLabel}</span>
    </button>
  );
}
