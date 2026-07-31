## Overview

The receiver reads telemetry from JSON files stored in a **"TAPE" (Telemetry Archive for Playback & Emulation)**. Each tape contains OpenTelemetry data encoded using **Protobuf JSON** and follows the OpenTelemetry Protocol (OTLP).

### 1. Raw Input Files

The receiver watches a directory for files named: raw_(metrics|traces|logs|profiles)\_#.json. They contain contain OTLP data serialized using the OpenTelemetry [File Exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/fileexporter).

### 2. Tape Creation

Raw files are converted into **tapes**, named: tape_(metrics|traces|logs|profiles)\_<earliest_event_ts>-<latest_event_ts>.json. Tapes are organized by **event time**, not by file creation time or capture time.

### 3. Replay Engine

- Tapes are read in **chronological order** based on original event timestamps.
- Telemetry is replayed according to the **original timing between events**, accurately reproducing real-world telemetry flow.
- Once the end of the final tape is reached, the receiver loops back and begins replaying from the first event.

## Key Features

- **True Time-Based Replay**  
  Honors original event timestamps and relative timing between events.

- **Deterministic Telemetry Playback**  
  Ideal for testing pipelines, demos, load simulations, and debugging without live data.

- **Continuous Looping**  
  Automatically restarts playback after reaching the end of the tape set.

- **OTLP-Compatible**  
  Works with telemetry serialized via the OpenTelemetry File Exporter.

## Quick Start

The following settings are required:

- `include_raw`: set a directory where to look for raw files to include in data collection
- `include_tape`: set a directory where to look for and place processed raw files

Example:

```yaml
receivers:
  vcr:
    include_raw:
      - "/var/log/raw/*.log"
    exclude_raw:
      - "/var/log/raw/example.log"
    include_tape:
      - "/var/log/tape/"
```