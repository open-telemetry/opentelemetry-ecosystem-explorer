## Configuration

The following settings are required:
 -  `endpoint` (default: `http://127.0.0.0:9490/metrics/array`): The URL of the scraper selected endpoint.
 -  `fa_array_name` (no default): The array's pretty name to be used as a metrics label.
 -  `namespace` (default:purefa): The selected Pure Storage OpenMetrics Namespace to query. 

In the below examples array01 is using the [Pure Storage FlashArray OpenMetrics exporter](https://github.com/PureStorage-OpenConnect/pure-fa-openmetrics-exporter), while array02 is using the native on-box metrics provided in Purity//FA v6.6.11+.

Example:

```yaml
extensions:
  bearertokenauth/array01:
    token: "..."
  bearertokenauth/array02:
    token: "..."

receivers:
  purefa/array01:
    fa_array_name: foobar01
    endpoint: http://127.0.0.1:9490/metrics
    array:
      - address: array01
        auth:
          authenticator: bearertokenauth/array01
    hosts:
      - address: array01
        auth:
          authenticator: bearertokenauth/array01
    directories:
      - address: array01
        auth:
          authenticator: bearertokenauth/array01
    pods:
      - address: array01
        auth:
          authenticator: bearertokenauth/array01
    volumes:
      - address: array01
        auth:
          authenticator: bearertokenauth/array01
    env: dev
    settings:
      reload_intervals:
        array: 20s
        hosts: 60s
        directories: 60s
        pods: 60s
        volumes: 60s

  purefa/array02:
    fa_array_name: foobar02
    endpoint: https://127.0.0.1/metrics
    tls:
      insecure_skip_verify: true
    array:
      - address: array02
        auth:
          authenticator: bearertokenauth/array02
    hosts:
      - address: array02
        auth:
          authenticator: bearertokenauth/array02
    directories:
      - address: array02
        auth:
          authenticator: bearertokenauth/array02
    pods:
      - address: array02
        auth:
          authenticator: bearertokenauth/array02
    volumes:
      - address: array02
        auth:
          authenticator: bearertokenauth/array02
    env: production
    settings:
      reload_intervals:
        array: 20s
        hosts: 60s
        directories: 60s
        pods: 60s
        volumes: 60s

service:
  extensions: [bearertokenauth/array01,bearertokenauth/array02]
  pipelines:
    metrics:
      receivers: [purefa/array01,purefa/array02]
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

