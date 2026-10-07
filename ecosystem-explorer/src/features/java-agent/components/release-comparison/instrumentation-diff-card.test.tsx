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
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstrumentationDiffCard } from "./instrumentation-diff-card";
import type { InstrumentationDiff } from "../../utils/release-diff";

function makeDiff(status: InstrumentationDiff["status"]): InstrumentationDiff {
  return {
    id: "akka-http-10.0",
    displayName: "Akka HTTP",
    status,
    telemetryDiff: { metrics: [], spans: [] },
  };
}

function renderCard(status: InstrumentationDiff["status"]) {
  render(
    <MemoryRouter>
      <InstrumentationDiffCard diff={makeDiff(status)} fromVersion="2.26.1" toVersion="2.31.1" />
    </MemoryRouter>
  );
  return screen.getByRole("link");
}

describe("InstrumentationDiffCard detail link", () => {
  it("links a removed instrumentation to the from version, where it still exists", () => {
    expect(renderCard("removed")).toHaveAttribute(
      "href",
      "/java-agent/instrumentation/akka-http-10.0?version=2.26.1"
    );
  });

  it("links an added instrumentation to the to version", () => {
    expect(renderCard("added")).toHaveAttribute(
      "href",
      "/java-agent/instrumentation/akka-http-10.0?version=2.31.1"
    );
  });

  it("links a changed instrumentation to the to version", () => {
    expect(renderCard("changed")).toHaveAttribute(
      "href",
      "/java-agent/instrumentation/akka-http-10.0?version=2.31.1"
    );
  });
});
