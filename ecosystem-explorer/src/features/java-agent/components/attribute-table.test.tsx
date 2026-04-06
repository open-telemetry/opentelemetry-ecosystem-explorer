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
import { AttributeTable } from "./attribute-table";
import type { Attribute } from "@/types/javaagent";

describe("AttributeTable", () => {
  const mockAttributes: Attribute[] = [
    { name: "http.method", type: "STRING" },
    { name: "http.status_code", type: "LONG" },
    { name: "http.response_time", type: "DOUBLE" },
  ];

  it("renders attribute table with correct structure", () => {
    render(<AttributeTable attributes={mockAttributes} />);

    const table = screen.getByRole("table", { name: "Attributes" });
    expect(table).toBeInTheDocument();
  });

  it("renders table headers correctly", () => {
    render(<AttributeTable attributes={mockAttributes} />);

    expect(screen.getByRole("columnheader", { name: "Key" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
  });

  it("renders all attributes with correct names and types", () => {
    render(<AttributeTable attributes={mockAttributes} />);

    const rows = screen.getAllByRole("row");
    // Should have header row + 3 data rows
    expect(rows).toHaveLength(4);

    expect(screen.getByText("http.method")).toBeInTheDocument();
    expect(screen.getByText("STRING")).toBeInTheDocument();

    expect(screen.getByText("http.status_code")).toBeInTheDocument();
    expect(screen.getByText("LONG")).toBeInTheDocument();

    expect(screen.getByText("http.response_time")).toBeInTheDocument();
    expect(screen.getByText("DOUBLE")).toBeInTheDocument();
  });

  it("returns null when attributes array is empty", () => {
    const { container } = render(<AttributeTable attributes={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders single attribute correctly", () => {
    const singleAttribute: Attribute[] = [{ name: "db.system", type: "STRING" }];

    render(<AttributeTable attributes={singleAttribute} />);

    expect(screen.getByText("db.system")).toBeInTheDocument();
    expect(screen.getByText("STRING")).toBeInTheDocument();
  });

  it("renders all attribute types correctly", () => {
    const allTypes: Attribute[] = [
      { name: "attr.string", type: "STRING" },
      { name: "attr.long", type: "LONG" },
      { name: "attr.double", type: "DOUBLE" },
      { name: "attr.boolean", type: "BOOLEAN" },
      { name: "attr.string_array", type: "STRING_ARRAY" },
      { name: "attr.long_array", type: "LONG_ARRAY" },
      { name: "attr.double_array", type: "DOUBLE_ARRAY" },
      { name: "attr.boolean_array", type: "BOOLEAN_ARRAY" },
    ];

    render(<AttributeTable attributes={allTypes} />);

    expect(screen.getByText("STRING")).toBeInTheDocument();
    expect(screen.getByText("LONG")).toBeInTheDocument();
    expect(screen.getByText("DOUBLE")).toBeInTheDocument();
    expect(screen.getByText("BOOLEAN")).toBeInTheDocument();
    expect(screen.getByText("STRING_ARRAY")).toBeInTheDocument();
    expect(screen.getByText("LONG_ARRAY")).toBeInTheDocument();
    expect(screen.getByText("DOUBLE_ARRAY")).toBeInTheDocument();
    expect(screen.getByText("BOOLEAN_ARRAY")).toBeInTheDocument();
  });
});
