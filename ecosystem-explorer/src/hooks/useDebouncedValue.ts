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

import { useState, useEffect } from "react";

/**
 * Hook that returns a debounced version of the input value.
 * Useful for delaying expensive operations like API calls until the user stops typing.
 *
 * @param value The value to debounce
 * @param delay Debounce delay in milliseconds (default: 250ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    let mounted = true;
    const id = setTimeout(() => {
      if (mounted) setDebounced(value);
    }, delay);
    return () => {
      mounted = false;
      clearTimeout(id);
    };
  }, [value, delay]);

  return debounced;
}
