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
import { validateField, validateAll } from "./config-validation";
import type { GroupNode, NumberInputNode, TextInputNode, SelectNode } from "@/types/configuration";

const textRequired: TextInputNode = {
  controlType: "text_input",
  key: "file_format",
  label: "File Format",
  path: "file_format",
  required: true,
};

const numberWithConstraints: NumberInputNode = {
  controlType: "number_input",
  key: "count_limit",
  label: "Count Limit",
  path: "attribute_limits.count_limit",
  nullable: true,
  constraints: { minimum: 0 },
};

const selectNode: SelectNode = {
  controlType: "select",
  key: "log_level",
  label: "Log Level",
  path: "log_level",
  enumOptions: [
    { value: "info", description: "info" },
    { value: "debug", description: "debug" },
  ],
};

describe("validateField", () => {
  it("should return error for missing required field", () => {
    expect(validateField(textRequired, undefined)).toBe("Required");
  });

  it("should return error for empty string on required field", () => {
    expect(validateField(textRequired, "")).toBe("Required");
  });

  it("should return null for valid required field", () => {
    expect(validateField(textRequired, "1.0")).toBeNull();
  });

  it("should return error for number below minimum", () => {
    expect(validateField(numberWithConstraints, -1)).toBe("Must be at least 0");
  });

  it("should return null for number at minimum", () => {
    expect(validateField(numberWithConstraints, 0)).toBeNull();
  });

  it("should return null for nullable field with null value", () => {
    expect(validateField(numberWithConstraints, null)).toBeNull();
  });

  it("should return error for invalid enum value", () => {
    expect(validateField(selectNode, "invalid")).toBe("Must be one of: info, debug");
  });

  it("should return null for valid enum value", () => {
    expect(validateField(selectNode, "info")).toBeNull();
  });
});

describe("validateAll", () => {
  const schema: GroupNode = {
    controlType: "group",
    key: "root",
    label: "Root",
    path: "",
    children: [
      textRequired,
      {
        controlType: "group",
        key: "attribute_limits",
        label: "Attribute Limits",
        path: "attribute_limits",
        children: [numberWithConstraints],
      } as GroupNode,
    ],
  };

  it("should return errors for invalid values", () => {
    const result = validateAll(
      schema,
      { attribute_limits: { count_limit: -5 } },
      { attribute_limits: true }
    );
    expect(result.valid).toBe(false);
    expect(result.errors["file_format"]).toBe("Required");
    expect(result.errors["attribute_limits.count_limit"]).toBe("Must be at least 0");
  });

  it("should skip disabled sections", () => {
    const result = validateAll(schema, {}, {});
    expect(result.errors["file_format"]).toBe("Required");
    expect(result.errors["attribute_limits.count_limit"]).toBeUndefined();
  });

  it("should return valid for correct values", () => {
    const result = validateAll(schema, { file_format: "1.0" }, {});
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("should report correct paths for deeply nested errors", () => {
    const deepSchema: GroupNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "tracer_provider",
          label: "Tracer Provider",
          path: "tracer_provider",
          children: [
            {
              controlType: "group",
              key: "sampler",
              label: "Sampler",
              path: "tracer_provider.sampler",
              children: [
                {
                  controlType: "number_input",
                  key: "ratio",
                  label: "Ratio",
                  path: "tracer_provider.sampler.ratio",
                  constraints: { minimum: 0 },
                } as NumberInputNode,
              ],
            } as GroupNode,
          ],
        } as GroupNode,
      ],
    };

    const result = validateAll(
      deepSchema,
      { tracer_provider: { sampler: { ratio: -1 } } },
      { tracer_provider: true }
    );
    expect(result.errors["tracer_provider.sampler.ratio"]).toBe("Must be at least 0");
  });
});
