import { describe, it, expect } from "vitest";
import { getSemanticConventionDisplayNames } from "./semantic-conventions";

describe("getSemanticConventionDisplayNames", () => {
  it("returns empty array for undefined input", () => {
    expect(getSemanticConventionDisplayNames(undefined)).toEqual([]);
  });

  it("returns empty array for empty array input", () => {
    expect(getSemanticConventionDisplayNames([])).toEqual([]);
  });

  it("maps known conventions to display names", () => {
    const result = getSemanticConventionDisplayNames([
      "HTTP_CLIENT_SPANS",
      "DATABASE_CLIENT_SPANS",
    ]);
    expect(result).toEqual(["Database", "HTTP"]);
  });

  it("deduplicates display names for related conventions", () => {
    const result = getSemanticConventionDisplayNames([
      "HTTP_CLIENT_SPANS",
      "HTTP_SERVER_SPANS",
      "HTTP_CLIENT_METRICS",
    ]);
    expect(result).toEqual(["HTTP"]);
  });

  it("preserves unknown conventions as-is", () => {
    const result = getSemanticConventionDisplayNames([
      "HTTP_CLIENT_SPANS",
      "UNKNOWN_CONVENTION",
      "CUSTOM_METRIC",
    ]);
    expect(result).toEqual(["CUSTOM_METRIC", "HTTP", "UNKNOWN_CONVENTION"]);
  });

  it("returns sorted results alphabetically", () => {
    const result = getSemanticConventionDisplayNames([
      "SYSTEM_METRICS",
      "DATABASE_CLIENT_SPANS",
      "GENAI_CLIENT_SPANS",
      "HTTP_SERVER_SPANS",
    ]);
    expect(result).toEqual(["Database", "GenAI", "HTTP", "System"]);
  });

  it("handles mixed known and unknown conventions", () => {
    const result = getSemanticConventionDisplayNames([
      "MESSAGING_SPANS",
      "CUSTOM_CONVENTION",
      "RPC_CLIENT_SPANS",
    ]);
    expect(result).toEqual(["CUSTOM_CONVENTION", "Messaging", "RPC"]);
  });
});
