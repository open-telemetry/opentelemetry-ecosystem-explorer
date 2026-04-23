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
import type { ConfigVersionsIndex, ConfigNode, ConfigStarter } from "@/types/configuration";
import { STORES } from "./idb-cache";
import { fetchWithCache } from "./fetch-with-cache";

const BASE_PATH = "/data/configuration";

export async function loadConfigVersions(): Promise<ConfigVersionsIndex> {
  const data = await fetchWithCache<ConfigVersionsIndex>(
    "config-versions-index",
    `${BASE_PATH}/versions-index.json`,
    STORES.CONFIGURATION
  );
  if (!data) throw new Error("Versions index returned null unexpectedly");
  return data;
}

export async function loadConfigSchema(version: string): Promise<ConfigNode> {
  const data = await fetchWithCache<ConfigNode>(
    `config-schema-${version}`,
    `${BASE_PATH}/versions/${version}.json`,
    STORES.CONFIGURATION
  );
  if (!data) throw new Error(`Schema for version ${version} returned null unexpectedly`);
  return data;
}

export async function loadConfigStarter(): Promise<ConfigStarter | null> {
  return fetchWithCache<ConfigStarter>(
    "config-starter",
    `${BASE_PATH}/defaults/sdk-configuration-defaults.json`,
    STORES.CONFIGURATION,
    { allow404: true }
  );
}
