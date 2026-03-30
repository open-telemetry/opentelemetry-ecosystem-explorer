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
import { flatToDeclarative, declarativeToFlat, flatToShellVar } from "./config-name-converter";

describe("config-name-converter", () => {
  describe("flatToDeclarative", () => {
    describe("SPECIAL_MAPPINGS", () => {
      it("converts general HTTP client request headers", () => {
        expect(flatToDeclarative("otel.instrumentation.http.client.capture-request-headers")).toBe(
          "general.http.client.request_captured_headers"
        );
      });

      it("converts general HTTP client response headers", () => {
        expect(flatToDeclarative("otel.instrumentation.http.client.capture-response-headers")).toBe(
          "general.http.client.response_captured_headers"
        );
      });

      it("converts general HTTP server request headers", () => {
        expect(flatToDeclarative("otel.instrumentation.http.server.capture-request-headers")).toBe(
          "general.http.server.request_captured_headers"
        );
      });

      it("converts general HTTP server response headers", () => {
        expect(flatToDeclarative("otel.instrumentation.http.server.capture-response-headers")).toBe(
          "general.http.server.response_captured_headers"
        );
      });

      it("converts HTTP known methods", () => {
        expect(flatToDeclarative("otel.instrumentation.http.known-methods")).toBe(
          "instrumentation.java.common.http.known_methods"
        );
      });

      it("converts HTTP client redact query parameters with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.http.client.experimental.redact-query-parameters")
        ).toBe("instrumentation.java.common.http.client.redact_query_parameters/development");
      });

      it("converts HTTP client emit experimental telemetry with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.http.client.emit-experimental-telemetry")
        ).toBe("instrumentation.java.common.http.client.emit_experimental_telemetry/development");
      });

      it("converts HTTP server emit experimental telemetry with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.http.server.emit-experimental-telemetry")
        ).toBe("instrumentation.java.common.http.server.emit_experimental_telemetry/development");
      });

      it("converts common db statement sanitizer", () => {
        expect(
          flatToDeclarative("otel.instrumentation.common.db-statement-sanitizer.enabled")
        ).toBe("instrumentation.java.common.database.statement_sanitizer.enabled");
      });

      it("converts common db sqlcommenter with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.common.experimental.db-sqlcommenter.enabled")
        ).toBe("instrumentation.java.common.database.sqlcommenter/development.enabled");
      });

      it("converts messaging receive telemetry with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.messaging.experimental.receive-telemetry.enabled")
        ).toBe("instrumentation.java.common.messaging.receive_telemetry/development.enabled");
      });

      it("converts messaging capture headers with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.messaging.experimental.capture-headers")
        ).toBe("instrumentation.java.common.messaging.capture_headers/development");
      });

      it("converts genai capture message content", () => {
        expect(flatToDeclarative("otel.instrumentation.genai.capture-message-content")).toBe(
          "instrumentation.java.common.gen_ai.capture_message_content"
        );
      });

      it("converts span suppression strategy with /development", () => {
        expect(
          flatToDeclarative("otel.instrumentation.experimental.span-suppression-strategy")
        ).toBe("instrumentation.java.common.span_suppression_strategy/development");
      });

      it("converts opentelemetry annotations exclude methods", () => {
        expect(
          flatToDeclarative("otel.instrumentation.opentelemetry-annotations.exclude-methods")
        ).toBe("instrumentation.java.opentelemetry_extension_annotations.exclude_methods");
      });

      it("converts semconv stability opt-in", () => {
        expect(flatToDeclarative("otel.semconv-stability.opt-in")).toBe(
          "general.semconv_stability.opt_in"
        );
      });
    });

    describe("mechanical conversion", () => {
      it("converts basic instrumentation property", () => {
        expect(flatToDeclarative("otel.instrumentation.jdbc.statement-sanitizer.enabled")).toBe(
          "instrumentation.java.jdbc.statement_sanitizer.enabled"
        );
      });

      it("replaces hyphens with underscores", () => {
        expect(flatToDeclarative("otel.instrumentation.my-custom-lib.some-property")).toBe(
          "instrumentation.java.my_custom_lib.some_property"
        );
      });

      it("handles experimental prefix with /development suffix", () => {
        expect(
          flatToDeclarative("otel.instrumentation.jdbc.experimental.transaction.enabled")
        ).toBe("instrumentation.java.jdbc.experimental/development.transaction.enabled");
      });

      it("handles experimental- prefix in segment", () => {
        expect(
          flatToDeclarative("otel.instrumentation.spring-webmvc.experimental-span-attributes")
        ).toBe("instrumentation.java.spring_webmvc.span_attributes/development");
      });

      it("preserves non-instrumentation properties", () => {
        expect(flatToDeclarative("otel.some.other.property")).toBe("otel.some.other.property");
      });

      it("handles properties without otel.instrumentation prefix", () => {
        expect(flatToDeclarative("custom.property.name")).toBe("custom.property.name");
      });
    });
  });

  describe("declarativeToFlat", () => {
    describe("reverse SPECIAL_MAPPINGS", () => {
      it("converts general HTTP client request headers back", () => {
        expect(declarativeToFlat("general.http.client.request_captured_headers")).toBe(
          "otel.instrumentation.http.client.capture-request-headers"
        );
      });

      it("converts HTTP known methods back", () => {
        expect(declarativeToFlat("instrumentation.java.common.http.known_methods")).toBe(
          "otel.instrumentation.http.known-methods"
        );
      });

      it("converts HTTP client emit experimental telemetry back", () => {
        expect(
          declarativeToFlat(
            "instrumentation.java.common.http.client.emit_experimental_telemetry/development"
          )
        ).toBe("otel.instrumentation.http.client.emit-experimental-telemetry");
      });

      it("converts common db statement sanitizer back", () => {
        expect(
          declarativeToFlat("instrumentation.java.common.database.statement_sanitizer.enabled")
        ).toBe("otel.instrumentation.common.db-statement-sanitizer.enabled");
      });

      it("converts semconv stability opt-in back", () => {
        expect(declarativeToFlat("general.semconv_stability.opt_in")).toBe(
          "otel.semconv-stability.opt-in"
        );
      });
    });

    describe("mechanical reverse conversion", () => {
      it("converts basic instrumentation property back", () => {
        expect(declarativeToFlat("instrumentation.java.jdbc.statement_sanitizer.enabled")).toBe(
          "otel.instrumentation.jdbc.statement-sanitizer.enabled"
        );
      });

      it("replaces underscores with hyphens", () => {
        expect(declarativeToFlat("instrumentation.java.my_custom_lib.some_property")).toBe(
          "otel.instrumentation.my-custom-lib.some-property"
        );
      });

      it("strips /development suffix", () => {
        expect(
          declarativeToFlat(
            "instrumentation.java.jdbc.experimental/development.transaction.enabled"
          )
        ).toBe("otel.instrumentation.jdbc.experimental.transaction.enabled");
      });

      it("preserves non-instrumentation properties", () => {
        expect(declarativeToFlat("custom.property.name")).toBe("custom.property.name");
      });
    });
  });

  describe("flatToShellVar", () => {
    it("converts to uppercase with underscores", () => {
      expect(flatToShellVar("otel.instrumentation.jdbc.statement-sanitizer.enabled")).toBe(
        "OTEL_INSTRUMENTATION_JDBC_STATEMENT_SANITIZER_ENABLED"
      );
    });

    it("replaces dots with underscores", () => {
      expect(flatToShellVar("otel.instrumentation.http.known-methods")).toBe(
        "OTEL_INSTRUMENTATION_HTTP_KNOWN_METHODS"
      );
    });

    it("replaces hyphens with underscores", () => {
      expect(flatToShellVar("otel.instrumentation.my-custom-lib.some-property")).toBe(
        "OTEL_INSTRUMENTATION_MY_CUSTOM_LIB_SOME_PROPERTY"
      );
    });

    it("handles experimental properties", () => {
      expect(flatToShellVar("otel.instrumentation.jdbc.experimental.transaction.enabled")).toBe(
        "OTEL_INSTRUMENTATION_JDBC_EXPERIMENTAL_TRANSACTION_ENABLED"
      );
    });
  });

  describe("round-trip conversions", () => {
    it("flat -> declarative -> flat for standard property", () => {
      const original = "otel.instrumentation.jdbc.statement-sanitizer.enabled";
      const declarative = flatToDeclarative(original);
      const backToFlat = declarativeToFlat(declarative);
      expect(backToFlat).toBe(original);
    });

    it("flat -> declarative -> flat for experimental property", () => {
      const original = "otel.instrumentation.jdbc.experimental.transaction.enabled";
      const declarative = flatToDeclarative(original);
      const backToFlat = declarativeToFlat(declarative);
      expect(backToFlat).toBe(original);
    });

    it("flat -> declarative -> flat for SPECIAL_MAPPINGS", () => {
      const original = "otel.instrumentation.http.known-methods";
      const declarative = flatToDeclarative(original);
      const backToFlat = declarativeToFlat(declarative);
      expect(backToFlat).toBe(original);
    });
  });
});
