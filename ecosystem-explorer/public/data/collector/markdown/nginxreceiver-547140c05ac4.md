## Configuration

### NGINX Module

You must configure NGINX to expose status information by editing the NGINX
configuration.  Please see
[ngx_http_stub_status_module](http://nginx.org/en/docs/http/ngx_http_stub_status_module.html)
for a guide to configuring the NGINX stats module `ngx_http_stub_status_module`.

### Receiver Config

The following settings are required:

- `endpoint` (default: `http://localhost:80/status`): The URL of the NGINX status endpoint

The following settings are optional:

- `collection_interval` (default = `10s`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). Valid time units are `ns`, `us` (or `µs`), `ms`, `s`, `m`, `h`.

- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

Example:

```yaml
receivers:
  nginx:
    endpoint: "http://localhost:80/status"
    collection_interval: 10s
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).
