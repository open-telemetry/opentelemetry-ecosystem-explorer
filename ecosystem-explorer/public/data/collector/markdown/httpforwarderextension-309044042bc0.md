## Configuration

The following settings are required:

- `egress`: HTTP config settings to use for forwarding requests.
  - `endpoint` (no default): The target to which requests should be forwarded to.

The following settings can be optionally configured:

- `ingress`: HTTP config settings for HTTP server listening to requests.
  - `endpoint` (default = `0.0.0.0:6060`): The host to which requests should be forwarded to.
- `egress`: HTTP config settings to use for forwarding requests.
  - `headers` (default = `nil`): Additional headers to be added to all requests passing through the extension.
  - `timeout` (default = `10s`): How long to wait for each request to complete.

### Example

```yaml
  http_forwarder:
    ingress:
      endpoint: localhost:7070
    egress:
      endpoint: http://target/
      headers:
        otel_http_forwarder: dev
      timeout: 5s
```

The full list of settings exposed for this exporter are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).
