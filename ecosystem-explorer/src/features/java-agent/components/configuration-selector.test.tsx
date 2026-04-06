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
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigurationSelector } from "./configuration-selector";
import type { Telemetry } from "@/types/javaagent";

describe("ConfigurationSelector", () => {
  const mockTelemetry: Telemetry[] = [
    {
      when: "default",
      metrics: [
        {
          name: "test.metric",
          description: "Test metric",
          type: "COUNTER",
          unit: "1",
        },
      ],
    },
    {
      when: "otel.instrumentation.http.enabled=true",
      metrics: [
        {
          name: "http.metric",
          description: "HTTP metric",
          type: "GAUGE",
          unit: "ms",
        },
      ],
    },
    {
      when: "otel.instrumentation.http.enabled=false",
      spans: [{ span_kind: "CLIENT" }],
    },
  ];

  it("renders info banner", () => {
    const onWhenChange = vi.fn();

    render(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="default"
        onWhenChange={onWhenChange}
      />
    );

    expect(screen.getByText("Telemetry varies by configuration")).toBeInTheDocument();
  });

  it("renders select element with label", () => {
    const onWhenChange = vi.fn();

    render(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="default"
        onWhenChange={onWhenChange}
      />
    );

    expect(screen.getByLabelText(/configuration/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders all telemetry configuration options", () => {
    const onWhenChange = vi.fn();

    render(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="default"
        onWhenChange={onWhenChange}
      />
    );

    const select = screen.getByRole("combobox");
    const options = within(select).getAllByRole("option");

    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("Default");
    expect(options[1]).toHaveTextContent("otel.instrumentation.http.enabled=true");
    expect(options[2]).toHaveTextContent("otel.instrumentation.http.enabled=false");
  });

  it("displays correct selected value", () => {
    const onWhenChange = vi.fn();

    render(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="default"
        onWhenChange={onWhenChange}
      />
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("default");
  });

  it("calls onWhenChange when selection changes", async () => {
    const user = userEvent.setup();
    const onWhenChange = vi.fn();

    render(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="default"
        onWhenChange={onWhenChange}
      />
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "otel.instrumentation.http.enabled=true");

    expect(onWhenChange).toHaveBeenCalledTimes(1);
    expect(onWhenChange).toHaveBeenCalledWith("otel.instrumentation.http.enabled=true");
  });

  it("renders with single configuration option", () => {
    const onWhenChange = vi.fn();
    const singleTelemetry: Telemetry[] = [
      {
        when: "always",
        metrics: [],
      },
    ];

    render(
      <ConfigurationSelector
        telemetry={singleTelemetry}
        selectedWhen="always"
        onWhenChange={onWhenChange}
      />
    );

    const select = screen.getByRole("combobox");
    const options = within(select).getAllByRole("option");

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("always");
  });

  it("updates selected value when selectedWhen prop changes", () => {
    const onWhenChange = vi.fn();
    const { rerender } = render(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="default"
        onWhenChange={onWhenChange}
      />
    );

    let select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("default");

    rerender(
      <ConfigurationSelector
        telemetry={mockTelemetry}
        selectedWhen="otel.instrumentation.http.enabled=true"
        onWhenChange={onWhenChange}
      />
    );

    select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("otel.instrumentation.http.enabled=true");
  });
});
