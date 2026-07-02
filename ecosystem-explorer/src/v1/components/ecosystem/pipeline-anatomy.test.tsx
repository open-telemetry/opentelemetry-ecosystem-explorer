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
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PipelineAnatomy } from "./pipeline-anatomy";

const STAGES = [
  {
    id: "receiver",
    label: "Receivers",
    count: 98,
    description: "Ingest data",
    href: "/collector/components?type=receiver",
  },
  {
    id: "processor",
    label: "Processors",
    count: 28,
    description: "Transform data",
    href: "/collector/components?type=processor",
  },
];

describe("PipelineAnatomy", () => {
  it("renders each stage as a link with the count and description", () => {
    render(
      <MemoryRouter>
        <PipelineAnatomy title="Pipeline" stages={STAGES} />
      </MemoryRouter>
    );
    const receiver = screen.getByRole("link", { name: /Receivers — 98 components/i });
    expect(receiver).toHaveAttribute("href", "/collector/components?type=receiver");
    expect(screen.getByText("Transform data")).toBeInTheDocument();
  });

  it("renders the section title and lead when provided", () => {
    render(
      <MemoryRouter>
        <PipelineAnatomy title="Pipeline anatomy" lead="The flow of telemetry." stages={STAGES} />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /Pipeline anatomy/i })).toBeInTheDocument();
    expect(screen.getByText(/The flow of telemetry/i)).toBeInTheDocument();
  });
});
