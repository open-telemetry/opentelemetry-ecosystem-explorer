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
import type { ConfigNode } from "@/types/configuration";
import type { ConfigurationBuilderState } from "@/types/configuration-builder";
import { generateYaml } from "./yaml-generator";

const emptySchema: ConfigNode = {
  controlType: "group",
  key: "root",
  label: "Root",
  path: "",
  children: [],
};

const emptyState: ConfigurationBuilderState = {
  version: "1.0.0",
  values: {},
  enabledSections: {},
  validationErrors: {},
  isDirty: false,
};

describe("generateYaml", () => {
  it("generates default header and respects override", () => {
    const defaultOutput = generateYaml(emptyState, emptySchema);
    expect(defaultOutput).toContain("# OpenTelemetry SDK Configuration");
    expect(defaultOutput).toContain("# Schema version: 1.0.0");

    const overridden = generateYaml(emptyState, emptySchema, { header: "# custom" });
    expect(overridden.startsWith("# custom\n")).toBe(true);
    expect(overridden).not.toContain("# OpenTelemetry SDK Configuration");
  });

  const fixtureSchema: ConfigNode = {
    controlType: "group",
    key: "root",
    label: "Root",
    path: "",
    children: [
      {
        controlType: "text_input",
        key: "file_format",
        label: "File Format",
        path: "file_format",
        description: "The file format version.",
        required: true,
      },
      {
        controlType: "group",
        key: "tracer_provider",
        label: "Tracer Provider",
        path: "tracer_provider",
        description: "Configure tracer provider.",
        children: [],
      },
      {
        controlType: "group",
        key: "resource",
        label: "Resource",
        path: "resource",
        description: "Configure resource for all signals.",
        children: [],
      },
      {
        controlType: "group",
        key: "logger_provider",
        label: "Logger Provider",
        path: "logger_provider",
        description: "Configure logger provider.",
        children: [],
      },
    ],
  };

  it("pins file_format first, alphabetizes sections, includes banner comments, ignores keys not in schema", () => {
    const state: ConfigurationBuilderState = {
      version: "1.0.1",
      values: {
        tracer_provider: { sampler: "always_on" },
        resource: { service_name: "demo" },
        logger_provider: { level: "info" },
        legacy_thing: { foo: "bar" },
      },
      enabledSections: {
        tracer_provider: true,
        resource: true,
        logger_provider: true,
        legacy_thing: true,
      },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, fixtureSchema, { header: "" });

    expect(output).toContain("file_format: 1.0.1");

    const fileFormatIdx = output.indexOf("file_format:");
    const loggerIdx = output.indexOf("logger_provider:");
    const resourceIdx = output.indexOf("resource:");
    const tracerIdx = output.indexOf("tracer_provider:");

    expect(fileFormatIdx).toBeGreaterThan(-1);
    expect(loggerIdx).toBeGreaterThan(fileFormatIdx);
    expect(resourceIdx).toBeGreaterThan(loggerIdx);
    expect(tracerIdx).toBeGreaterThan(resourceIdx);

    expect(output).toContain("# Logger Provider — Configure logger provider.");
    expect(output).toContain("# Resource — Configure resource for all signals.");
    expect(output).toContain("# Tracer Provider — Configure tracer provider.");

    expect(output).not.toContain("legacy_thing");
  });

  it("emits enabled groups with values, emits empty object for enabled groups that strip to empty", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "filled_section",
          label: "Filled",
          path: "filled_section",
          children: [],
        },
        {
          controlType: "group",
          key: "empty_section",
          label: "Empty",
          path: "empty_section",
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: {
        filled_section: { setting: "value" },
        empty_section: { a: null, b: "", c: { d: null, e: "" } },
      },
      enabledSections: {
        filled_section: true,
        empty_section: true,
      },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).toContain("filled_section:");
    expect(output).toContain("setting: value");
    expect(output).toMatch(/^empty_section:$/m);
  });

  it("omits groups with enabledSections[key] !== true", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { tracer_provider: { sampler: "always_on" } },
      enabledSections: { tracer_provider: false },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).not.toContain("tracer_provider:");
    expect(output).not.toContain("sampler: always_on");
  });

  it("emits top-level non-group values when present, omits when null", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "toggle",
          key: "disabled",
          label: "Disabled",
          path: "disabled",
          description: "Configure if the SDK is disabled or not.",
        },
      ],
    };

    const present: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { disabled: false },
      enabledSections: {},
      validationErrors: {},
      isDirty: false,
    };
    const presentOutput = generateYaml(present, schema, { header: "" });
    expect(presentOutput).toContain("disabled: false");

    const absent: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { disabled: null },
      enabledSections: {},
      validationErrors: {},
      isDirty: false,
    };
    const absentOutput = generateYaml(absent, schema, { header: "" });
    expect(absentOutput).not.toContain("disabled:");
  });

  it("preserves false and 0, strips null and empty string", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "section",
          label: "Section",
          path: "section",
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: {
        section: {
          a: false,
          b: 0,
          c: null,
          d: "",
          e: "x",
        },
      },
      enabledSections: { section: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).toContain("a: false");
    expect(output).toContain("b: 0");
    expect(output).toContain("e: x");
    expect(output).not.toMatch(/\bc:/);
    expect(output).not.toMatch(/\bd:/);
  });

  it("preserves plugin_select discriminator inside list, emits empty object for empty group at top level", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
        {
          controlType: "group",
          key: "empty_provider",
          label: "Empty Provider",
          path: "empty_provider",
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: {
        tracer_provider: {
          processors: [{ batch: {} }],
        },
        empty_provider: { something: null, another: "" },
      },
      enabledSections: {
        tracer_provider: true,
        empty_provider: true,
      },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).toContain("tracer_provider:");
    expect(output).toContain("processors:");
    expect(output).toMatch(/^ {4}- batch:$/m);

    expect(output).toMatch(/^empty_provider:$/m);
  });

  it("preserves standalone plugin_select discriminator with null value", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { tracer_provider: { sampler: { always_on: null } } },
      enabledSections: { tracer_provider: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).toContain("sampler:");
    expect(output).toMatch(/^ {4}always_on:$/m);
  });

  it("preserves standalone plugin_select discriminator with empty object", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { tracer_provider: { sampler: { always_on: {} } } },
      enabledSections: { tracer_provider: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).toContain("sampler:");
    expect(output).toContain("always_on:");
  });

  it("preserves nested plugin_select chain with bare discriminators", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
        {
          controlType: "group",
          key: "propagator",
          label: "Propagator",
          path: "propagator",
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: {
        tracer_provider: {
          sampler: { parent_based: { root: { always_on: null } } },
        },
        propagator: {
          composite: [{ tracecontext: null }, { baggage: null }],
        },
      },
      enabledSections: { tracer_provider: true, propagator: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });

    expect(output).toContain("parent_based:");
    expect(output).toContain("root:");
    expect(output).toMatch(/^ {8}always_on:$/m);
    expect(output).toMatch(/^ {4}- tracecontext:$/m);
    expect(output).toMatch(/^ {4}- baggage:$/m);
  });

  it("emits empty object for enabled top-level group with stripped body", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "text_input",
          key: "file_format",
          label: "File Format",
          path: "file_format",
          required: true,
        },
        {
          controlType: "group",
          key: "resource",
          label: "Resource",
          path: "resource",
          children: [
            {
              controlType: "text_input",
              key: "name",
              label: "Name",
              path: "resource.name",
              nullable: true,
            },
          ],
        },
      ],
    };
    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { resource: { name: null } },
      enabledSections: { resource: true },
      validationErrors: {},
      isDirty: false,
    };
    const out = generateYaml(state, schema);
    expect(out).toMatch(/^resource:$/m);
  });

  it("skips disabled top-level group even if it has values", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "resource",
          label: "Resource",
          path: "resource",
          children: [
            { controlType: "text_input", key: "name", label: "Name", path: "resource.name" },
          ],
        },
      ],
    };
    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { resource: { name: "svc" } },
      enabledSections: { resource: false },
      validationErrors: {},
      isDirty: false,
    };
    const out = generateYaml(state, schema);
    expect(out).not.toMatch(/resource:/);
  });

  it("collapses empty object values at list-item position", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { tracer_provider: { processors: [{ batch: {} }] } },
      enabledSections: { tracer_provider: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });
    expect(output).toMatch(/^ {4}- batch:$/m);
    expect(output).not.toMatch(/- batch: \{\}/);
  });

  it("collapses null values at nested discriminator position", () => {
    const schema: ConfigNode = {
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
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { tracer_provider: { sampler: { always_on: null } } },
      enabledSections: { tracer_provider: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });
    expect(output).toMatch(/^ {4}always_on:$/m);
    expect(output).not.toMatch(/always_on: null/);
  });

  it("does not collapse non-empty scalar values on the same line", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "resource",
          label: "Resource",
          path: "resource",
          children: [],
        },
      ],
    };

    const state: ConfigurationBuilderState = {
      version: "1.0.0",
      values: { resource: { service_name: "demo", endpoint: "http://localhost:4318" } },
      enabledSections: { resource: true },
      validationErrors: {},
      isDirty: false,
    };

    const output = generateYaml(state, schema, { header: "" });
    expect(output).toContain("service_name: demo");
    expect(output).toContain("endpoint: http://localhost:4318");
  });
});
