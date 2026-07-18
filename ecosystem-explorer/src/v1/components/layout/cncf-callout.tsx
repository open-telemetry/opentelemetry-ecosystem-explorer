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

/*
 * CncfCallout — explorer-original chrome that sits above FooterV1 on every
 * v1 route. No upstream opentelemetry.io equivalent (grep'd: zero hits in
 * `layouts/_partials/` or `themes/docsy/`). Content follows the redesign
 * brief (`projects/84-ui-ux-design/ecosystem-explorer-v1-design-brief.md`
 * lines 55, 82) and the mockup at `ecosystem-explorer-v1-mockups.html:1738`.
 *
 * Surface uses OTel-secondary (purple) per the brief — `td-box--secondary` —
 * which the design brief identifies as the canonical sitewide-callout color.
 * The mockup uses a neutral `box-muted`; the brief is the more recent intent.
 */

import { CncfLogo } from "@/v1/components/icons/cncf-logo";

export function CncfCallout() {
  return (
    <section className="td-cncf-callout" aria-labelledby="cncf-callout-heading">
      <div className="td-cncf-callout__container">
        <p id="cncf-callout-heading" className="td-cncf-callout__lead">
          <strong>
            OpenTelemetry is a{" "}
            <a
              href="https://cncf.io"
              target="_blank"
              rel="noopener noreferrer"
              className="td-cncf-callout__link"
            >
              CNCF
            </a>{" "}
            graduated project.
          </strong>
          <br />
          Formed through a merger of the OpenTracing and OpenCensus projects.
        </p>
        <CncfLogo className="td-cncf-callout__logo" />
      </div>
    </section>
  );
}
