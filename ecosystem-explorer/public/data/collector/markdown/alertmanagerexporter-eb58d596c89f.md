Exports OTEL Events (SpanEvent in Tracing added by AddEvent API and Log Records) as Alerts to [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/) back-end to notify Errors or Change events.

Supported pipeline types: traces, logs

## Getting Started

The following settings are required:

- `endpoint`: Alertmanager endpoint to send events
- `severity`: Default severity for Alerts


The following settings are optional:

- `timeout` `sending_queue` and `retry_on_failure` settings as provided by [Exporter Helper](https://github.com/open-telemetry/opentelemetry-collector/tree/main/exporter/exporterhelper#configuration).
- [HTTP settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/confighttp/README.md)
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
- `generator_url` is the source of the alerts to be used in Alertmanager's payload. The default value is "opentelemetry-collector", and can be set to the URL of the opentelemetry collector.
- `severity_attribute` is the SpanEvent or LogRecord Attribute name which can be used instead of default severity string in Alert payload.
   e.g.: If `severity_attribute` is set to "foo" and the SpanEvent or LogRecord has an attribute called foo, foo's attribute value will be used as the severity value for that particular Alert generated from the SpanEvent or LogRecord.
- `api_version` is the API version of [Alertmanager](https://prometheus.io/docs/alerting/latest/clients/). By default the value is set to "v2" and can be overridden to "v1" if using an older version of Alertmanager.
- `event_labels` is the list of Event or LogRecord Attributes that will be captured as Labels in the Alert payload if value exists.

Example config:

```yaml
exporters:
  alertmanager:
  alertmanager/2:
    endpoint: "https://a.new.alertmanager.target:9093"
    severity: "debug"
    severity_attribute: "foo"
    api_version: "v2"
    event_labels: ["foo", "bar"]
    tls:
      cert_file: /var/lib/mycert.pem
      key_file: /var/lib/key.pem
    timeout: 10s
    sending_queue:
      enabled: true
      num_consumers: 2
      queue_size: 10
    retry_on_failure:
      enabled: true
      initial_interval: 10s
      max_interval: 60s
      max_elapsed_time: 10m
    generator_url: "opentelemetry-collector"
```
