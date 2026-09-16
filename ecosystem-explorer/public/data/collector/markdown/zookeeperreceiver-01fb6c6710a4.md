## Configuration

- `endpoint`: (default = `localhost:2181`) Endpoint to connect to collect metrics. Takes the form `host:port`. See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.
- `timeout`: (default = `10s`) Timeout within which requests should be completed.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

Example configuration.

```yaml
receivers:
  zookeeper:
    endpoint: "localhost:2181"
    collection_interval: 20s
    initial_delay: 1s
```

## Scraper

Details about the scraper in [README.md](../../scraper/zookeeperscraper/README.md)
