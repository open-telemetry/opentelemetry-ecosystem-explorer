This receiver gets GCP (Google Cloud Platform) metrics from [GCP Monitoring REST API] via the [Google SDK for GCP Metrics] and then convert those timeseries data into OTel Format [Pipeline Data].

[GCP Monitoring REST API]: https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list
[Google SDK for GCP Metrics]: https://pkg.go.dev/cloud.google.com/go/monitoring/apiv3
[Pipeline Data]: https://pkg.go.dev/go.opentelemetry.io/collector/pdata

## Configuration
The following configuration options are supported:

```yaml
receivers:
  googlecloudmonitoring:
    collection_interval: 2m # Can be specified in seconds (s), minutes (m), or hours (h)
    project_id: my-project-id
    metrics_list:
      - metric_name: "compute.googleapis.com/instance/cpu/usage_time"
      - metric_name: "connectors.googleapis.com/flex/instance/cpu/usage_time"
```

- `collection_interval` (Optional): The interval at which metrics are collected. Default is 300s, minimum is 60s. Be careful of the [costs](https://cloud.google.com/stackdriver/pricing#monitoring-costs) and [quotas](https://cloud.google.com/monitoring/quotas#api_quotas) when setting a low interval.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.
- `timeout`: (default = `1m`) The timeout of running commands against the GCP Monitoring REST API.
- `project_id` (Required): The GCP project ID.
- `endpoint` (Optional): Overrides the default `monitoring.googleapis.com:443` endpoint. Use this when targeting non-standard universe domains.
- `metrics_list` (Required): A list of services metrics to monitor.

Each single metric can have the following configuration:

- `metric_name` (Optional): The specific metric name to collect.
- `metric_descriptor_filter` (Optional): Filter for [listing metric descriptors](https://cloud.google.com/monitoring/api/v3/filters#metric-descriptor-filter). Only support `project` and `metric.type` as filter objects.

One of `metric_name` and `metric_descriptor_filter` MUST be specified, but MUST not be specified at the same time.

## Authentication with Google Cloud

For more details on authentication, refer to the Google Cloud [Application Default Credentials documentation](https://cloud.google.com/docs/authentication/application-default-credentials). Note that if your workload is running on Google Cloud Platform (GCP), the service account credentials will be used automatically without needing to set the environment variable manually.

### Filtering

**Metrics Parameters** :

- A monitoring filter that specifies which time series should be returned. The filter must specify a single metric type. For example: `metric_name: "compute.googleapis.com/instance/cpu/usage_time"`
