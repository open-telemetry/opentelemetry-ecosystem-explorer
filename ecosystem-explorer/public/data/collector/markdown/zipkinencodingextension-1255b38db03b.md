The extension supports the following configuration options:
* `protocol`: either `zipkin_proto`, `zipkin_json` or `zipkin_thrift`
* `version`: `v1` or `v2`

The default configuration is as follows:

```yaml
extensions:
  zipkin_encoding:
    protocol: zipkin_proto
    version: v2
```