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
import { useEffect, useState } from "react";

/**
 * Hook that returns `true` only once `active` has held `true` for `delay` ms.
 *
 * Intended for gating loading placeholders: a skeleton that paints and clears
 * within a few frames reads as a flash, which is a worse experience than showing
 * nothing at all. Gating on this hook means a fast response never paints one,
 * while a genuinely slow one still gets its placeholder.
 */
export function useDelayedFlag(active: boolean, delay = 300): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setTimeout(() => setElapsed(true), delay);
    // Resetting on teardown rather than in the effect body keeps the next active
    // episode waiting out a full delay, without a synchronous setState in an effect.
    return () => {
      clearTimeout(id);
      setElapsed(false);
    };
  }, [active, delay]);

  // Gate on `active` too, so the flag drops on the same render that `active` does
  // rather than a render later, once the teardown has reset `elapsed`.
  return active && elapsed;
}
