## Deprecated

This exporter is deprecated and will be removed in a future release. Mezmo now
supports ingesting OpenTelemetry data directly via OTLP, so a Mezmo-specific
exporter is no longer necessary. To migrate, use the
[OTLP/HTTP exporter](https://github.com/open-telemetry/opentelemetry-collector/tree/main/exporter/otlphttpexporter)
to send logs directly to Mezmo. See the following for migration guidance:

- https://docs.mezmo.com/telemetry-pipelines/otel-collector
- https://docs.mezmo.com/telemetry-pipelines/open-telemetry-source

This exporter supports sending OpenTelemetry log data to
[Mezmo](https://mezmo.com).

Note: Mezmo logs ingestion [requires a `hostname`](https://docs.mezmo.com/docs/log-parsing#hostname)
field to be present. When logs are sent via this exporter, and `hostname`
metadata is not added, the Mezmo ingestion API will set `hostname=otel`. To
provide the `hostname` information, we recommend adding a
[Resource Detection Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/resourcedetectionprocessor)
to the collector configuration. Doing so will cause this exporter to
automatically add the `hostname` metadata to the outgoing log data whenever
it is available. See the below example configuration for a basic configuration
that adds `hostname` detection support.

# Configuration options:

- `ingest_url` (optional): Specifies the URL to send ingested logs to.  If not 
specified, will default to `https://logs.mezmo.com/otel/ingest/rest`.
- `ingest_key` (required): Ingestion key used to send log data to Mezmo.  See
[Ingestion Keys](https://docs.mezmo.com/docs/ingestion-key) for more details.

# Example:
## Simple Log Data

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: ":4317"

processors:
  resource_detection:
    detectors:
      - system
    system:
      hostname_sources:
        - os

exporters:
  mezmo:
    ingest_url: "https://logs.mezmo.com/otel/ingest/rest"
    ingest_key: "00000000000000000000000000000000"

service:
  pipelines:
    logs:
      receivers: [ otlp ]
      processors: [ resource_detection ]
      exporters: [ mezmo ]
```
