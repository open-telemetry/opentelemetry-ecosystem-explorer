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
import type { DataState } from "@/hooks/data-state";
import type { Stability } from "@/components/ui/status-pill";

export const ACTIVITY_FEED_URL = "/data/activity/feed.json";

export type ActivityStability = Stability | "new";

export interface ActivityItem {
  id: string;
  title: string;
  stability: ActivityStability;
  ecosystem: string;
  version: string | null;
  occurredAt: string;
  href: string;
}

interface FeedShape {
  generatedAt: string;
  items: ActivityItem[];
}

export interface UseActivityFeedOptions {
  feedUrl?: string;
  limit?: number;
}

export function useActivityFeed({
  feedUrl = ACTIVITY_FEED_URL,
  limit = 5,
}: UseActivityFeedOptions = {}): DataState<ActivityItem[]> {
  const [state, setState] = useState<DataState<ActivityItem[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ data: null, loading: true, error: null });
      try {
        const res = await fetch(feedUrl);
        if (!res.ok) throw new Error(`Feed responded with ${res.status}`);
        const feed = (await res.json()) as FeedShape;
        if (cancelled) return;
        setState({ data: feed.items.slice(0, limit), loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [feedUrl, limit]);

  return state;
}
