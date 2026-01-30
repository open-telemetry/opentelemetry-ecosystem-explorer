# Documentation Sync

Automation tool for synchronizing documentation with the OpenTelemetry ecosystem registry.

## Overview

This tool updates documentation files by replacing content between marker comments with generated content from the
ecosystem registry.

## Usage

From the repository root:

```bash
uv run documentation-sync
```

## Development

See the parent [ecosystem-automation README](../README.md) for setup and testing instructions.

### Running Tests

```bash
# From repository root
uv run pytest ecosystem-automation/documentation-sync/tests
```
