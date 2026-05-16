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
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
