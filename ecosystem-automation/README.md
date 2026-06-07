# Ecosystem Automation

Automation tools for the OpenTelemetry Ecosystem Explorer project.

**Note: This directory is part of a uv workspace. All package management should be done from the
repository root using `uv` commands.**

## Components

- **collector-watcher**: Collects and aggregates metadata from OpenTelemetry Collector components
- **java-instrumentation-watcher**: Collects and aggregates metadata from the OpenTelemetry Java
  Instrumentation project
- **dotnet-instrumentation-watcher**: Collects and aggregates metadata from the OpenTelemetry .NET
  Automatic Instrumentation project
- **configuration-watcher**: Collects the OpenTelemetry declarative configuration schema
- **explorer-db-builder**: Builds the database for the ecosystem explorer web application
- **v1-registry-sync**: Compares the collector registry against the upstream OpenTelemetry v1
  registry
- **watcher-common**: Shared base classes for inventory management, version detection, and content
  hashing used by the watchers and the db-builder

**Setup**: See [Contributing Guide](../CONTRIBUTING.md#getting-started) for project setup.

## Running Tests

```bash
# Run all tests
uv run pytest ecosystem-automation/

# Run tests for a specific package
uv run pytest ecosystem-automation/collector-watcher/tests/
uv run pytest ecosystem-automation/java-instrumentation-watcher/tests/
uv run pytest ecosystem-automation/dotnet-instrumentation-watcher/tests/
uv run pytest ecosystem-automation/configuration-watcher/tests/
uv run pytest ecosystem-automation/explorer-db-builder/tests/
uv run pytest ecosystem-automation/v1-registry-sync/tests/

# Run tests with coverage for a particular module
uv run pytest --cov=collector_watcher ecosystem-automation/collector-watcher/tests/
```
