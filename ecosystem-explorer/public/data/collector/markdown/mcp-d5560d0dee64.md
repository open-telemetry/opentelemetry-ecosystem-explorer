This extension runs the OpenTelemetry MCP server which enables LLM to efficiently use OpenTelemetry stack.

## Configuration

```yaml
extensions:
  mcp:
    endpoint: 0.0.0.0:8080
```

## Available Tools

### Schema & Documentation

| Tool | Description |
|------|-------------|
| `get-versions` | Get all supported OpenTelemetry collector versions |
| `components` | List all components of a given kind (receiver, exporter, processor, connector, extension) for a version |
| `readme` | Get the README for a specific component |
| `changelog` | Get the changelog for a collector version |
| `component-schema` | Get the configuration schema for a specific component |
| `component-schema-validation` | Validate a component configuration JSON against its schema |
| `component-deprecated-fields` | List deprecated configuration fields for one or more components |
| `rag` | Answer questions about the collector using documentation search |
