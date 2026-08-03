Note: in the future, Elasticsearch will be instrumented with the OpenTelemetry Java SDK directly (https://github.com/elastic/elasticsearch/issues/109335).
When this is complete, native OpenTelemetry metrics may be added for measuring cluster health, index statistics, and so on. Please subscribe to the linked issue to keep updated.

## Prerequisites

This receiver supports Elasticsearch versions 7.9+

If Elasticsearch security features are enabled, you must have either the `monitor` or `manage` cluster privilege.
See the [Elasticsearch docs](https://www.elastic.co/guide/en/elasticsearch/reference/current/authorization.html) for more information on authorization and [Security privileges](https://www.elastic.co/guide/en/elasticsearch/reference/current/security-privileges.html).

## Configuration

The following settings are optional:

- `nodes` (default: `["_all"]`): Allows specifying node filters that define which nodes are scraped for node-level and cluster-level metrics. See [the Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/7.9/cluster.html#cluster-nodes) for allowed filters. If this option is left explicitly empty, then no node-level metrics will be scraped and cluster-level metrics will scrape only metrics related to cluster's health.
- `skip_cluster_metrics` (default: `false`): If true, cluster-level metrics will not be scraped.
- `indices` (default: `["_all"]`): Allows specifying index filters that define which indices are scraped for index-level metrics. See [the Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-stats.html#index-stats-api-path-params) for allowed filters. If this option is left explicitly empty, then no index-level metrics will be scraped.
- `endpoint` (default = `http://localhost:9200`): The base URL of the Elasticsearch API for the cluster to monitor.
- `username` (no default): Specifies the username used to authenticate with Elasticsearch using basic auth. Must be specified if password is specified.
- `password` (no default): Specifies the password used to authenticate with Elasticsearch using basic auth. Must be specified if username is specified.
- `collection_interval` (default = `10s`): This receiver collects metrics on an interval. This value must be a string readable by Golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration). On larger clusters, the interval may need to be lengthened, as querying Elasticsearch for metrics will take longer on clusters with more nodes.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

### Example Configuration

```yaml
receivers:
  elasticsearch:
    metrics:
      elasticsearch.node.fs.disk.available:
        enabled: false
    nodes: ["_local"]
    skip_cluster_metrics: true
    indices: [".geoip_databases"]
    endpoint: http://localhost:9200
    username: otel
    password: password
    collection_interval: 10s
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

## Metrics

The following metric are available with versions:

- `elasticsearch.indexing_pressure.memory.limit` >= [7.10](https://www.elastic.co/guide/en/elasticsearch/reference/7.16/release-notes-7.10.0.html)
- `elasticsearch.node.shards.data_set.size` >= [7.13](https://www.elastic.co/guide/en/elasticsearch/reference/7.16/release-notes-7.13.0.html)
- `elasticsearch.cluster.state_update.count` >= [7.16.0](https://www.elastic.co/guide/en/elasticsearch/reference/7.16/release-notes-7.16.0.html)
- `elasticsearch.cluster.state_update.time` >= [7.16.0](https://www.elastic.co/guide/en/elasticsearch/reference/7.16/release-notes-7.16.0.html)

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml).
Refer to [documentation.md](./documentation.md) for information on how to enable and disable metrics produced by this
receiver.
