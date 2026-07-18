---
title: "Roadmap - JavaScript Instrumentation Research"
issue: 9
type: roadmap
phase: meta
status: in-progress
last_updated: "2026-05-17"
---

## Done

- [x] Cloned js-contrib repo and audited all 47 packages
- [x] Identified machine-readable fields available today
- [x] Produced 3 example registry entries (express, mongoose, aws-sdk)
- [x] Audited telemetry coverage across all READMEs
- [x] Documented heading inconsistencies across the 8 packages with structured telemetry data

## In progress

- [ ] Deeper pass on the 8 packages with structured telemetry, can their data be parsed reliably
      despite heading differences?
- [ ] Draft Phase 1 watcher architecture

## Open questions

1. Should the watcher use a sparse Git clone or GitHub API calls? (Git clone is faster for bulk
   reads, API is simpler for CI)
2. What is the minimum viable schema for Phase 1 - which fields must be present before the Explorer
   can show a JS package page?
3. Is there appetite in the js-contrib community to standardize telemetry documentation format or
   add metadata.yaml files?
4. How should the Explorer handle the 6 packages with no supported versions heading?
5. Should unmaintained packages (empty owner arrays) be included in the registry or excluded?
