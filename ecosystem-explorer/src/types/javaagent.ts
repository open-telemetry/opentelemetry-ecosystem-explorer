export interface VersionsIndex {
  versions: VersionInfo[];
}

export interface VersionInfo {
  version: string;
  is_latest: boolean;
}

export interface VersionManifest {
  instrumentations: Record<string, string>;
}

export interface InstrumentationData {
  name: string;
  display_name?: string;
  description?: string;
  library_link?: string;
  source_path?: string;
  tags?: string[];
  semantic_conventions?: string[];
  scope: InstrumentationScope;
  target_versions?: TargetVersions;
  configurations?: Configuration[];
  telemetry?: Telemetry[];
}

export interface InstrumentationScope {
  name: string;
  schema_url?: string;
}

export interface TargetVersions {
  javaagent?: string[];
  library?: string[];
}

export interface Configuration {
  name: string;
  description: string;
  type: "boolean" | "string" | "list" | "map" | "int" | "double";
  default: string | boolean | number;
}

export interface Telemetry {
  when: string;
  metrics?: Metric[];
  spans?: Span[];
}

export interface Metric {
  name: string;
  description: string;
  type: "COUNTER" | "GAUGE" | "HISTOGRAM" | "SUMMARY";
  unit: string;
  attributes?: Attribute[];
}

export interface Span {
  span_kind: "CLIENT" | "SERVER" | "PRODUCER" | "CONSUMER" | "INTERNAL";
  attributes?: Attribute[];
}

export interface Attribute {
  name: string;
  type:
    | "STRING"
    | "LONG"
    | "DOUBLE"
    | "BOOLEAN"
    | "STRING_ARRAY"
    | "LONG_ARRAY"
    | "DOUBLE_ARRAY"
    | "BOOLEAN_ARRAY";
}
