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
import { BrowserRouter } from "react-router-dom";
import { LegacyApp } from "@/LegacyApp";
import { V1App } from "@/v1";
import { isEnabled } from "@/lib/feature-flags";

/*
 * Single V1_REDESIGN boundary read. See
 * `projects/84-ui-ux-design/v1-routing-pivot.md` for the routing pivot context.
 * Both sub-apps share canonical paths under a single <BrowserRouter>; per-deploy
 * bundle selection is driven by netlify.toml's `feat/84-*` branch pattern.
 */
export default function App() {
  return <BrowserRouter>{isEnabled("V1_REDESIGN") ? <V1App /> : <LegacyApp />}</BrowserRouter>;
}
