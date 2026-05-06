# Ecosystem Automation

Automation tools for the OpenTelemetry Ecosystem Explorer project.

**Note: This directory is part of a uv workspace. All package management should be done from the
repository root using `uv` commands.**

## Components

- **collector-watcher**: Collects and aggregates metadata from OpenTelemetry Collector components
- **java-instrumentation-watcher**: Collects and aggregates metadata from the OpenTelemetry Java
  Instrumentation project
- **explorer-db-builder**: Builds the database for the ecosystem explorer web application

**Setup**: See [Contributing Guide](../CONTRIBUTING.md#getting-started) for project setup.

## Running Tests

```bash
# Run all tests
uv run pytest ecosystem-automation/

# Run tests for a specific package
uv run pytest ecosystem-automation/collector-watcher/tests/
uv run pytest ecosystem-automation/java-instrumentation-watcher/tests/
uv run pytest ecosystem-automation/explorer-db-builder/tests/

# Run tests with coverage for a particular module
uv run pytest --cov=collector_watcher --cov=collector_watcher
```
