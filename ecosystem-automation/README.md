# Ecosystem Automation

Automation tools for the OpenTelemetry Ecosystem Explorer project.

**Note: This directory is part of a uv workspace. All package management should be done from the repository root using
`uv` commands.**

## Components

- **collector-watcher**: Collects and aggregates metadata from OpenTelemetry Collector components
- **java-instrumentation-watcher**: Collects and aggregates metadata from the OpenTelemetry Java Instrumentation project
- **documentation-sync**: Synchronizes documentation with the ecosystem registry

## Setup

This project uses [uv](https://github.com/astral-sh/uv) for dependency management.

### Prerequisites

- Python 3.11+
- uv package manager

Install uv if you don't have it:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Installation

From the repository root:

```bash
# Install all dependencies
uv sync

# Run tests
uv run pytest

# Run linting
uv run ruff check .
uv run ruff format .
```

### Running Tests

```bash
# Run all tests
uv run pytest ecosystem-automation/

# Run tests for a specific package
uv run pytest ecosystem-automation/collector-watcher/tests/
uv run pytest ecosystem-automation/java-instrumentation-watcher/tests/
uv run pytest ecosystem-automation/documentation-sync/tests/

# Run tests with coverage for a particular module
uv run pytest --cov=collector_watcher --cov=documentation_sync
```
