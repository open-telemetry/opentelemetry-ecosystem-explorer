## Configuration

The following settings are required:

* `endpoint` (default = `localhost:8088`): Address and port that the Splunk HEC
  receiver should bind to.

See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.

The following settings are optional:

* `access_token_passthrough` (default = `false`): Whether to preserve incoming
  access token (`Splunk` header value) as
  `"com.splunk.hec.access_token"` metric resource label.  Can be used in
  tandem with identical configuration option for [Splunk HEC
  exporter](../../exporter/splunkhecexporter/README.md) to preserve datapoint
  origin.
* `tls_settings` (no default): This is an optional object used to specify if TLS should be used for
  incoming connections. Please consult [configtls] for the complete list of options available.
    * `cert_file`: Specifies the certificate file to use for TLS connection.
      Note: Both `key_file` and `cert_file` are required for TLS connection.
    * `key_file`: Specifies the key file to use for TLS connection. Note: Both
      `key_file` and `cert_file` are required for TLS connection.
* `raw_path` (default = '/services/collector/raw'): The path accepting [raw HEC events](https://help.splunk.com/en/splunk-enterprise/get-data-in/get-started-with-getting-data-in/10.0/get-data-with-http-event-collector/format-events-for-http-event-collector#example-5-curl-statement-sending-raw-data-0). Only applies when the receiver is used for logs.
* `splitting` defines the splitting strategy used by the receiver when ingesting raw events. Can be set to "line" or "none". Default is "line".
* `health_path` (default = '/services/collector/health'): The path reporting [health checks](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/9.0/input-endpoints/input-endpoint-descriptions#services.2Fcollector.2Fhealth).
* `hec_metadata_to_otel_attrs/source` (default = 'com.splunk.source'): Specifies the mapping of the source field to a specific unified model attribute.
* `hec_metadata_to_otel_attrs/sourcetype` (default = 'com.splunk.sourcetype'): Specifies the mapping of the sourcetype field to a specific unified model attribute.
* `hec_metadata_to_otel_attrs/index` (default = 'com.splunk.index'): Specifies the mapping of the index field to a specific unified model attribute.
* `hec_metadata_to_otel_attrs/host` (default = 'host.name'): Specifies the mapping of the host field to a specific unified model attribute.
* `ack` (no default): defines the ackextension to use for acknowledging events
  * `extension` (no default): Specifies the ack extension ID the receiver should use. If left blank, ack is disabled.
  * `path` (default = '/services/collector/ack'): The path the ack extension will listen on for ack requests, if the extension is enabled.
  
Example:

```yaml
receivers:
  splunk_hec:
  splunk_hec/advanced:
    access_token_passthrough: true
    tls:
      cert_file: /test.crt
      key_file: /test.key
    raw_path: "/raw"
    hec_metadata_to_otel_attrs:
      source: "mysource"
      sourcetype: "mysourcetype"
      index: "myindex"
      host: "myhost"
    ack: 
      extension: ack/in_memory
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go)
with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

[configtls]: https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls
