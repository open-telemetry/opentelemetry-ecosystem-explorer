Each payload is expected to contain a single Jaeger `Span`. The span is converted
into OpenTelemetry traces, using the span's `Process` as the resource.

The extension supports the following configuration options:
* `protocol`: either `protobuf` (default) or `json`.
  * `protobuf`: the payload is deserialized as a single Jaeger proto `Span`.
  * `json`: the payload is deserialized as a single Jaeger JSON `Span` using `jsonpb`.

The default configuration is as follows:

```yaml
extensions:
  jaeger_encoding:
    protocol: protobuf
```

## Example

The following configuration uses the extension with the Kafka receiver to consume
Jaeger spans encoded as protobuf:

```yaml
extensions:
  jaeger_encoding:
    protocol: protobuf

receivers:
  kafka:
    traces:
      encoding: jaeger_encoding

service:
  extensions: [jaeger_encoding]
  pipelines:
    traces:
      receivers: [kafka]
      exporters: [debug]

exporters:
  debug:
```
