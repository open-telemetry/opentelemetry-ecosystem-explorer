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
import type { DataState } from "@/hooks/data-state";
import { resolveDataPath } from "@/lib/api/fetch-with-cache";

export interface Announcement {
  id: string;
  date: string;
  title: string;
  body: string;
  link?: string;
}

export function useJavaAgentAnnouncements(): DataState<Announcement[]> {
  const [state, setState] = useState<DataState<Announcement[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAnnouncements() {
      try {
        const response = await fetch(resolveDataPath("data/javaagent", "announcements.json"));
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(
            `Failed to load announcements: ${response.status} ${response.statusText}`
          );
        }

        const announcements: Announcement[] = await response.json();
        if (cancelled) return;

        setState({
          data: announcements,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }

    loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
