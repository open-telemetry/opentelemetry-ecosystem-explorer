# Agent Readiness Documentation

This document describes the infrastructure and patterns used to make the OpenTelemetry Ecosystem
Explorer "agent-ready" for AI context ingestion.

## Context Ingestion Standards

We implement the `llms.txt` and `llms-full.txt` standards to provide a structured entry point for AI
agents (e.g., Claude, ChatGPT, Gemini).

- **Location**: `/llms.txt` and `/llms-full.txt`
- **Purpose**: Map high-level documentation to structured metadata.
- **Auto-generation**: These files are generated at build time via
  `ecosystem-explorer/scripts/generate-agent-docs.mjs`.

## Structured Metadata (JSON)

Agents can access structured JSON data for all ecosystem components. This data is versioned and
hashed to ensure consistency.

- **Collector Components**: `/data/collector/components/{id}/{id}-{hash}.json`
- **Java Agent Instrumentations**: `/data/javaagent/instrumentations/{id}/{id}-{hash}.json`

### JSON Schemas

All structured metadata follows strict JSON schemas:

- **Collector Component**: `/schemas/collector-component.schema.json`
- **Java Agent Instrumentation**: `/schemas/javaagent-instrumentation.schema.json`

## Schema Synchronization

> [!IMPORTANT] To ensure AI agents always have access to accurate metadata definitions, JSON schemas
> are automatically generated from the TypeScript type definitions during the build process.

### Current Implementation

- **Source of Truth**: The TypeScript interfaces in `ecosystem-explorer/src/types/` (e.g.,
  `CollectorComponent`, `InstrumentationData`).
- **Automation**: The `bun run generate-schemas` script uses `typescript-json-schema` to emit the
  schemas to `public/schemas/` and Prettier-formats them. It is the single regeneration path, shared
  by `build`, a pre-commit hook, and CI.
- **Syncing**: A pre-commit hook regenerates the schemas whenever the source types or the generator
  change, and the `Schemas up to date` CI job fails if the committed schemas drift from the types,
  so any change to the frontend's data model stays reflected in the schemas consumed by agents.

### Verification

- **Sync Enforcement**: A pre-commit hook and the `Schemas up to date` CI job (in
  `build-and-test.yml`) regenerate the schemas and fail on any drift from the TypeScript types,
  keeping the committed files in sync.
- **Build-time Check**: The documentation generation script (`generate-agent-docs.mjs`) references
  these schemas and includes them in the `llms.txt` index.
- **Header Enforcement**: Netlify Edge Functions ensure these schemas are served with the correct
  `application/json` content-type and strict 404 handling.

## Navigation Patterns for Agents

Agents are instructed via `llms.txt` to follow these patterns:

- Use `/agent/collector/index.md` as the primary index for collector components.
- Use `/agent/javaagent/index.md` as the primary index for javaagent instrumentations.
- Navigate to specific component metadata using the versioned JSON URLs found in these indices.
