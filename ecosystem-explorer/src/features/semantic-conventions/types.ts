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

export type TimelineEventType =
  "domain" | "baseline" | "stability" | "change" | "deprecation" | "removed" | "moved";

export interface TimelineLaneDef {
  id: string;
  title: string;
  subtitle: string;
}

export interface TimelineEvent {
  id: string;
  lane: string;
  release: string | null;
  type: TimelineEventType;
  short: string;
  title: string;
  detail: string;
  source: string;
  major: boolean;
  /** ISO date (YYYY-MM-DD), UTC. */
  date: string;
  transition?: string;
  dateBasis?: "specification-commit";
  commit?: string;
  pullRequest?: number;
  firstRelease?: string;
  lineageSource?: string;
}

export interface TimelineData {
  lanes: TimelineLaneDef[];
  events: TimelineEvent[];
  /** Release version -> ISO release date (UTC), not necessarily every patch release. */
  dates: Record<string, string>;
}
