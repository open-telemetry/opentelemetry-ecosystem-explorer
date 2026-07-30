## Receiver Configuration

Faro follows the [confighttp] configuration, some examples are shown below


### Example Configuration

```yaml
receivers:
  faro:
    endpoint: 'localhost:8081'
```

### Advanced Configuration
```yaml
receivers:
  faro:
    endpoint: 'localhost:8081'
    cors:
      allowed_origins: "*"
```

[confighttp]: https://github.com/open-telemetry/opentelemetry-collector/tree/main/config/confighttp#server-configuration
