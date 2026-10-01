> **Deprecation Notice:** The component type has been renamed from `grafanacloud` to `grafana_cloud`
> to follow the OpenTelemetry snake_case naming convention.
> The old name `grafanacloud` still works but is deprecated and will be removed in a future release.
> Please update your configuration to use `grafana_cloud`.

## Overview

The Grafana Cloud Connector (grafanacloudconnector) is a connector component that can analyze telemetry in pipelines to generate usage metrics for the following Grafana Cloud products:
* Application Observability

## Usage

```yaml
connectors:
  grafana_cloud/connector:

extensions:
  basicauth/grafana_cloud:
    client_auth:
      username: "${env:GRAFANA_CLOUD_INSTANCE_ID}"
      password: "${env:GRAFANA_CLOUD_API_KEY}"

exporters:
  otlphttp/grafana_cloud:
    endpoint: "${env:GRAFANA_CLOUD_OTLP_ENDPOINT}"
    auth:
      authenticator: basicauth/grafana_cloud

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlphttp/grafana_cloud, grafana_cloud/connector]

    metrics:
      receivers: [otlp, grafana_cloud/connector]
      exporters: [otlphttp/grafana_cloud]
```

In this example configuration, usage metrics for Grafana Cloud Application Observability are derived from incoming spans.

## Configuration

```yaml
connectors:
  grafanacloud/connector:
    ## @param host_identifiers List of span attributes used to identify the host running the workloads.
    ## The first matching attribute is used.
    # host_identifiers: ["k8s.node.name", "host.id", "k8s.node.uid"]
    ## @param metrics_flush_interval Interval at which host metrics are flushed.
    ## Valid values are between 15s and 5m.
    # metrics_flush_interval: 60s
```

### Example configuration for the component

```yaml
connectors:
  grafana_cloud:
    host_identifiers: ["mycompany.myHostAttribute", "k8s.node.name", "host.id", "k8s.node.uid"]
    metrics_flush_interval: 60s
```

This connector will generate a host info metric based on the first `host_identifiers` resource attribute found on spans. The rest are skipped. Valid flush intervals are between 15s and 5m.
