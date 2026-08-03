> **Note:** This receiver was renamed from `kafkametrics` to `kafka_metrics` to match the snake_case naming convention.
> The deprecated component type `kafkametrics` is still accepted as an alias and will log a deprecation warning.

## Prerequisites

This receiver supports Kafka versions:
  -  2.X
  -  3.X

## Feature gates

See [documentation.md](./documentation.md) for the complete list of feature gates supported by this processor.

Feature gates can be enabled using the `--feature-gates` flag:

```shell
"--feature-gates=<feature-gate>"
```

## Getting Started

Required settings (no defaults):

- `scrapers`: any combination of the following scrapers can be enabled.
    - `topics`
    - `consumers`
    - `brokers`

Metrics collected by the associated scraper are listed in [metadata.yaml](metadata.yaml)

Optional Settings (with defaults):

- `cluster_alias`: Alias name of the cluster. Adds `kafka.cluster.alias` resource attribute.
- `protocol_version` (default = 2.1.0): Kafka protocol version
- `brokers` (default = localhost:9092): the list of brokers to read from.
- `resolve_canonical_bootstrap_servers_only` (default = false): whether to resolve then reverse-lookup broker IPs during startup.
- `topic_match` (default = ^[^_].*$): regex pattern of topics to filter on metrics collection. The default filter excludes internal topics (starting with `_`).
- `group_match` (default = .*): regex pattern of consumer groups to filter on for metrics.
- `client_id` (default = otel-collector): consumer client id
- `collection_interval` (default = 1m): frequency of metric collection/scraping.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.
- `tls`: see [TLS Configuration Settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md) for the full set of available options.
- `auth` (default none)
    - `plain_text` (Deprecated in v0.123.0: use sasl with mechanism set to PLAIN instead.)
        - `username`: The username to use.
        - `password`: The password to use
    - `sasl`
        - `username`: The username to use.
        - `password`: The password to use.
        - `mechanism`: The sasl mechanism to use (SCRAM-SHA-256, SCRAM-SHA-512, AWS_MSK_IAM_OAUTHBEARER, or PLAIN)
        - `aws_msk`
            - `region`: AWS Region in case of AWS_MSK_IAM_OAUTHBEARER mechanism
    - `tls` ((Deprecated in v0.124.0: configure tls at the top level): this is an alias for tls at the top level.
    - `kerberos`
        - `service_name`: Kerberos service name
        - `realm`: Kerberos realm
        - `use_keytab`:  Use of keytab instead of password, if this is true, keytab file will be used instead of
          password
        - `username`: The Kerberos username used for authenticate with KDC
        - `password`: The Kerberos password used for authenticate with KDC
        - `config_file`: Path to Kerberos configuration. i.e /etc/krb5.conf
        - `keytab_file`: Path to keytab file. i.e /etc/security/kafka.keytab
        - `disable_fast_negotiation`: Disable PA-FX-FAST negotiation (Pre-Authentication Framework - Fast). Some common Kerberos implementations do not support PA-FX-FAST negotiation. This is set to `false` by default.
- `metadata`
  - `full` (default = true): Whether to maintain a full set of metadata. When disabled, the client does not make the initial request to broker at the startup.
  - `retry`
    - `max` (default = 3): The number of retries to get metadata
    - `backoff` (default = 250ms): How long to wait between metadata retries

## Examples:

1) Basic configuration with all scrapers:

```yaml
receivers:
  kafka_metrics:
    scrapers:
      - brokers
      - topics
      - consumers
```

2) Configuration with more optional settings:

For this example:
- A non-default broker is specified
- cluster alias is set to "kafka-prod"
- collection interval is 5 secs.
- Kafka protocol version is 3.0.0
- mTLS is configured

```yaml
receivers:
  kafka_metrics:
    cluster_alias: kafka-prod
    brokers: ["10.10.10.10:9092"]
    protocol_version: 3.0.0
    scrapers:
      - brokers
      - topics
      - consumers
    tls:
      ca_file: ca.pem
      cert_file: cert.pem
      key_file: key.pem
    collection_interval: 5s
```
