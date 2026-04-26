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
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface UseActiveSectionResult {
  activeKey: string | null;
  scrollToSection: (key: string) => void;
}

const OFFSET_LINE_PX = 80;
const LOCK_FALLBACK_MS = 700;

function findSection(
  containerRef: RefObject<HTMLElement | null> | undefined,
  key: string
): HTMLElement | null {
  const selector = `[data-section-key="${key}"]`;
  return (containerRef?.current ?? document).querySelector<HTMLElement>(selector);
}

/**
 * Tracks which section is currently dominating the viewport, given a list of
 * section keys identified by `data-section-key` attributes. Exposes
 * `scrollToSection` for programmatic navigation.
 *
 * Implementation follows the Tailwind/Mantine geometry pattern — a passive
 * scroll listener picks the last section whose top has crossed the offset
 * line — plus a click lock cleared by `scrollend` so the smooth scroll
 * triggered by `scrollToSection` cannot fight the listener.
 *
 * Scroll/resize events are coalesced via `requestAnimationFrame` so the
 * geometry sweep runs at most once per frame regardless of event volume.
 * Pass a container ref to scope the section lookup; otherwise the hook
 * searches the whole document.
 */
export function useActiveSection(
  sectionKeys: string[],
  containerRef?: RefObject<HTMLElement | null>
): UseActiveSectionResult {
  const depKey = sectionKeys.join("|");
  const [activeKey, setActiveKey] = useState<string | null>(
    sectionKeys.length > 0 ? sectionKeys[0] : null
  );
  // Reset activeKey to null at render time when the key set empties out,
  // rather than dispatching it from inside the effect (where the
  // react-hooks/set-state-in-effect rule rightly flags it as a cascading
  // render trigger).
  const [prevDepKey, setPrevDepKey] = useState(depKey);
  if (prevDepKey !== depKey) {
    setPrevDepKey(depKey);
    if (sectionKeys.length === 0) setActiveKey(null);
  }
  const lockedRef = useRef(false);

  useEffect(() => {
    if (sectionKeys.length === 0) return;

    const compute = () => {
      if (lockedRef.current) return;
      let current = sectionKeys[0];
      for (const key of sectionKeys) {
        const el = findSection(containerRef, key);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= OFFSET_LINE_PX + 1) {
          current = key;
        }
      }
      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
        current = sectionKeys[sectionKeys.length - 1];
      }
      setActiveKey(current);
    };

    let rafId = 0;
    const scheduleCompute = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        compute();
      });
    };

    compute();
    window.addEventListener("scroll", scheduleCompute, { passive: true });
    window.addEventListener("resize", scheduleCompute);
    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleCompute);
      window.removeEventListener("resize", scheduleCompute);
    };
    // depKey is a derived primitive; sectionKeys identity may change per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, containerRef]);

  const scrollToSection = useCallback(
    (key: string) => {
      const el = findSection(containerRef, key);
      if (!el) return;
      setActiveKey(key);
      lockedRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus({ preventScroll: true });

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        lockedRef.current = false;
      };
      window.addEventListener("scrollend", release, { once: true });
      window.setTimeout(release, LOCK_FALLBACK_MS);
    },
    [containerRef]
  );

  return { activeKey, scrollToSection };
}
