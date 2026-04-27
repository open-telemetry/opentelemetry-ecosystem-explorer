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

describe("YamlCodeBlock", () => {
  it("renders the code inside a <pre>", () => {
    const { container } = render(<YamlCodeBlock code='key: "v"' />);
    expect(container.querySelector("pre")).not.toBeNull();
  });

  it("preserves the original text content character-for-character", () => {
    const code = '# c\nkey: "v"\n  - name: x\n';
    const { container } = render(<YamlCodeBlock code={code} />);
    expect(container.querySelector("pre")?.textContent).toBe(code);
  });

  it("emits y-key, y-punct, y-string spans for a key/value pair", () => {
    const { container } = render(<YamlCodeBlock code='endpoint: "https://x"' />);
    expect(container.querySelector("span.y-key")?.textContent).toBe("endpoint");
    expect(container.querySelector("span.y-punct")?.textContent).toBe(":");
    expect(container.querySelector("span.y-string")?.textContent).toBe('"https://x"');
  });

  it("forwards className to the <pre> element", () => {
    const { container } = render(<YamlCodeBlock code="" className="custom-x" />);
    expect(container.querySelector("pre")?.className).toContain("custom-x");
  });
});
