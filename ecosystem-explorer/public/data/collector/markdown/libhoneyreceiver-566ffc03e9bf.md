## Configuration

The configuration has 2 parts, One is the HTTP receiver configuration and the rest is about mapping attributes from the
freeform libhoney format into the more structured OpenTelemetry objects.

### Example configuration for the component

The following settings are required:

- `http`
  - `endpoint` must set an endpoint. Defaults to `127.0.0.1:8080`
  - `compression_algorithms` (optional): List of supported compression algorithms. Defaults to `["", "gzip", "zstd", "zlib", "deflate"]`. Set to `[]` to disable automatic decompression.
- `resources`: if the `service.name` field is different, map it here.
- `scopes`: to get the `library.name` and `library.version` set in the scope section, set them here.
- `attributes`: if the other trace-related data have different keys, map them here, defaults are otlp-like field names.

The following setting is required for refinery traffic since:

- `auth_api`: should be set to `https://api.honeycomb.io` or a proxy that forwards to that host.
  Some libhoney software checks `/1/auth` to get environment names so it needs to be passed through.

```yaml
  libhoney:
    http:
      endpoint: 0.0.0.0:8088
      traces_url_paths:
        - "/1/events"
        - "/1/batch"
      include_metadata: true
    auth_api: https://api.honeycomb.io
    fields:
      resources:
        service_name: service_name
      scopes:
        library_name: library.name
        library_version: library.version
      attributes:
        trace_id: trace_id
        parent_id: parent_id
        span_id: span_id
        name: name
        error: error
        spankind: span.kind
        durationFields:
          - duration_ms
```

### Compression Support

The receiver supports automatic decompression of compressed request bodies using confighttp.ServerConfig defaults.

#### Disabling Compression

If you're experiencing issues with clients that send incorrect `Content-Encoding` headers (claiming data is compressed when it's not), you can disable automatic decompression:

```yaml
receivers:
  libhoney:
    http:
      endpoint: 0.0.0.0:8088
      compression_algorithms: []  # Disable all automatic decompression
```

#### Custom Compression Algorithms

You can specify exactly which compression algorithms to support:

```yaml
receivers:
  libhoney:
    http:
      endpoint: 0.0.0.0:8088
      compression_algorithms: ["gzip", "zstd"]  # Only support gzip and zstd
```

### Telemetry data types supported

It will subscribe to the Traces and Logs signals but accept traffic destined for either pipeline using one http receiver
component. Libhoney does not differentiate between the two so the receiver will identify which pipeline to deliver the 
spans or log records to.

No support for metrics since they'd look just like logs.
