const SEMANTIC_CONVENTION_DISPLAY_MAP: Record<string, string> = {
  HTTP_CLIENT_SPANS: "HTTP",
  HTTP_CLIENT_METRICS: "HTTP",
  HTTP_SERVER_SPANS: "HTTP",
  HTTP_SERVER_METRICS: "HTTP",
  DATABASE_CLIENT_SPANS: "Database",
  DATABASE_CLIENT_METRICS: "Database",
  DATABASE_POOL_METRICS: "Database",
  MESSAGING_SPANS: "Messaging",
  RPC_CLIENT_SPANS: "RPC",
  RPC_CLIENT_METRICS: "RPC",
  RPC_SERVER_SPANS: "RPC",
  RPC_SERVER_METRICS: "RPC",
  GENAI_CLIENT_SPANS: "GenAI",
  GENAI_CLIENT_METRICS: "GenAI",
  FAAS_SERVER_SPANS: "FaaS",
  GRAPHQL_SERVER_SPANS: "GraphQL",
  SYSTEM_METRICS: "System",
};

export function getSemanticConventionDisplayNames(conventions: string[] | undefined): string[] {
  if (!conventions || conventions.length === 0) {
    return [];
  }

  const displayNames = new Set<string>();

  for (const convention of conventions) {
    const displayName = SEMANTIC_CONVENTION_DISPLAY_MAP[convention];
    if (displayName) {
      displayNames.add(displayName);
    } else {
      displayNames.add(convention);
    }
  }

  return Array.from(displayNames).sort();
}
