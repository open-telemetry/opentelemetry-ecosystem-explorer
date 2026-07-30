This extension accepts OTLP data encoded using Protobuf or JSON protocols.

Example using Protobuf protocol:
```yaml
extensions:
  otlp_encoding:
    protocol: otlp_proto
```

Example using JSON protocol:
```yaml
extensions:
  otlp_encoding:
    protocol: otlp_json
```
