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
import { render } from "@testing-library/react";
import { YamlCodeBlock } from "./yaml-code-block";

const makeStructured = (header = "", fileFormat = "", key = "test", content = "") => ({
  header,
  fileFormat,
  sections: content ? [{ key, content }] : [],
});

describe("YamlCodeBlock", () => {
  it("renders the code inside a <pre>", () => {
    const structured = makeStructured("", "", "test", 'key: "v"');
    const { container } = render(<YamlCodeBlock structured={structured} activePreviewKey={null} />);
    expect(container.querySelector("pre")).not.toBeNull();
  });

  it("renders the provided text content sections", () => {
    const header = "# c\n";
    const fileFormat = 'file_format: "1.0"\n';
    const content = 'key: "v"\n  - name: x\n';
    const structured = makeStructured(header, fileFormat, "test", content);
    const { container } = render(<YamlCodeBlock structured={structured} activePreviewKey={null} />);

    const preContent = container.querySelector("pre")?.textContent;
    expect(preContent).toContain("# c");
    expect(preContent).toContain('file_format: "1.0"');
    expect(preContent).toContain('key: "v"');
    expect(preContent).toContain("- name: x");
  });

  it("emits y-key, y-punct, y-string spans for a key/value pair", () => {
    const structured = makeStructured("", "", "test", 'endpoint: "https://x"');
    const { container } = render(<YamlCodeBlock structured={structured} activePreviewKey={null} />);
    expect(container.querySelector("span.y-key")?.textContent).toBe("endpoint");
    expect(container.querySelector("span.y-punct")?.textContent).toBe(":");
    expect(container.querySelector("span.y-string")?.textContent).toBe('"https://x"');
  });
  it("applies active styles when activePreviewKey matches a section", () => {
    const structured = {
      header: "",
      fileFormat: "",
      sections: [
        { key: "general", content: "general: true\n" },
        { key: "instrumentations", content: "instrumentations:\n  jdbc: true\n" },
      ],
    };
    const { container } = render(
      <YamlCodeBlock structured={structured} activePreviewKey="general" />
    );

    const generalSection = container.querySelector('[data-yaml-section="general"]');
    const instrumentationsSection = container.querySelector(
      '[data-yaml-section="instrumentations"]'
    );

    expect(generalSection?.className).toContain("bg-otel-orange/10");
    expect(generalSection?.className).toContain("border-l-otel-orange");

    expect(instrumentationsSection?.className).not.toContain("bg-otel-orange/10");
    expect(instrumentationsSection?.className).toContain("border-l-transparent");
  });

  it("activates a section when activePreviewKey is a nested key under it", () => {
    const structured = {
      header: "",
      fileFormat: "",
      sections: [
        { key: "distribution", content: "distribution:\n  javaagent: {}\n" },
        {
          key: "instrumentation/development",
          content: "instrumentation/development:\n  general:\n    http:\n      semconv: stable\n",
        },
      ],
    };
    const { container } = render(
      <YamlCodeBlock
        structured={structured}
        activePreviewKey="instrumentation/development.general.http"
      />
    );

    const devSection = container.querySelector('[data-yaml-section="instrumentation/development"]');
    const distributionSection = container.querySelector('[data-yaml-section="distribution"]');

    expect(devSection?.className).toContain("bg-otel-orange/10");
    expect(devSection?.className).toContain("border-l-otel-orange");

    expect(distributionSection?.className).not.toContain("bg-otel-orange/10");
    expect(distributionSection?.className).toContain("border-l-transparent");
  });

  it("forwards className to the <pre> element", () => {
    const structured = makeStructured();
    const { container } = render(
      <YamlCodeBlock structured={structured} activePreviewKey={null} className="custom-x" />
    );
    expect(container.querySelector("pre")?.className).toContain("custom-x");
  });
});
