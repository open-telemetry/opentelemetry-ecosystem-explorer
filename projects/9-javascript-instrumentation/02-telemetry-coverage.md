---
title: "Telemetry Coverage - JavaScript Instrumentation READMEs"
issue: 9
type: audit
phase: 1
status: in-progress
last_updated: "2026-05-17"
---

Detailed breakdown of how telemetry data is documented across the 47 instrumentation packages in
`opentelemetry-js-contrib`.

## Summary

| Coverage level                    | Count | Packages                                                                    |
| --------------------------------- | ----- | --------------------------------------------------------------------------- |
| Structured table (markdown)       | 1     | aws-sdk                                                                     |
| Structured headings, list format  | 7     | cassandra-driver, dataloader, hapi, kafkajs, nestjs-core, pg, web-exception |
| Telemetry mentioned in prose only | 39    | All others                                                                  |
| No telemetry documentation        | 0     | -                                                                           |

## The best case - aws-sdk

`instrumentation-aws-sdk` has a `## Span Attributes` section with a proper markdown table:

| Attribute      | Type   | Description                 | Example          |
| -------------- | ------ | --------------------------- | ---------------- |
| `rpc.system`   | string | Always equals "aws-api"     |                  |
| `rpc.method`   | string | Name of the operation       | `PutObject`      |
| `rpc.service`  | string | Name of the service         | `S3`, `DynamoDB` |
| `cloud.region` | string | Region name for the request | `eu-west-1`      |

This is the format that would be parseable. 1 out of 47 packages reaches this standard.

## The typical case - mongoose

`instrumentation-mongoose` mentions telemetry under `## Semantic Conventions` with a link to the
semconv spec but no list of what attributes are actually emitted. A user cannot determine what spans
or attributes to expect without reading the source code.

## The missing case - express

`instrumentation-express` has no dedicated telemetry section at all. The README documents
configuration options and caveats but says nothing about what spans, attributes, or metrics the
instrumentation produces.

## Implication for the watcher

A Phase 1 watcher can be built today using only structured sources (package.json, .tav.yml,
component_owners.yml, auto-instrumentations deps). Telemetry data cannot be reliably included in
Phase 1 without either:

1. README parsing with significant error handling for inconsistent formats (fragile)
2. A standardized metadata file per package in js-contrib (correct long-term fix, requires upstream
   coordination)

The long-term fix is contributing tooling back to js-contrib that generates READMEs from structured
metadata files, solving the problem at the source rather than parsing inconsistent documentation
downstream.
