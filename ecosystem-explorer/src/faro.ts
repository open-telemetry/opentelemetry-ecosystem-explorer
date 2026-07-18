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
import { getWebInstrumentations, initializeFaro } from "@grafana/faro-react";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

const faroUrl = import.meta.env.VITE_FARO_URL;

if (faroUrl) {
  initializeFaro({
    url: faroUrl,
    app: {
      name: "ecosystem-explorer",
      version: "0.0.0",
      environment: import.meta.env.MODE,
    },
    instrumentations: [...getWebInstrumentations(), new TracingInstrumentation()],
    ignoreErrors: [
      /^ResizeObserver loop limit exceeded$/,
      /^ResizeObserver loop completed with undelivered notifications$/,
      /^Script error\.$/,
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],
  });
}
