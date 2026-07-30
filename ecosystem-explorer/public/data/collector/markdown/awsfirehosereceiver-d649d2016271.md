## Configuration

Example:

```yaml
receivers:
  awsfirehose:
    endpoint: 0.0.0.0:4433
    encoding: awscloudwatchmetricstreams_encoding
    access_key: "some_access_key"
    tls:
      cert_file: server.crt
      key_file: server.key

extensions:
  awscloudwatchmetricstreams_encoding:
    format: json
```

The configuration includes the OpenTelemetry collector's server [confighttp](https://github.com/open-telemetry/opentelemetry-collector/tree/main/config/confighttp#server-configuration),
which allows for a variety of settings. Only the most relevant ones will be discussed here, but all are available.

The Amazon Data Firehose Delivery Streams currently only support HTTPS endpoints using port 443.
This can be potentially circumvented using a Load Balancer.

### endpoint:
The address:port to bind the listener to.

default: `localhost:4433`

See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.

### tls:
See [documentation](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md#server-configuration) for more details.

A `cert_file` and `key_file` are required.

### encoding:

The ID of an [encoding extension](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/encoding) for decoding logs or metrics.
This configuration also supports the built-in encodings listed in the [Encodings](#encodings) section.

If no encoding is specified, then the receiver will default to a signal-specific encoding: `cwmetrics` for metrics, and `cwlogs` for logs.
In the future, the default encodings will be removed, and it will be required to specify an encoding extension.

### record\_type:

Deprecated, use `encoding` instead. `record_type` will be removed in a future release; it is an alias for `encoding`.

### access\_key (Optional):
The access key to be checked on each request received. This can be set when creating or updating the delivery stream.
See [documentation](https://docs.aws.amazon.com/firehose/latest/dev/create-destination.html#create-destination-http) for details.

## Encodings

Any encoding extension can be used with this receiver. There are additionally built-in encodings, which are deprecated.
In the future it will be required to specify an encoding extension, and the built-in encodings will be removed.

### cwmetrics (deprecated)

The built-in `cwmetrics` encoding is deprecated and will be removed in a future version.
Use the [`awscloudwatchmetricstreams_encoding`](../../extension/encoding/awscloudwatchmetricstreamsencodingextension)
extension with `format: json` instead.

```yaml
extensions:
  awscloudwatchmetricstreams_encoding:
    format: json
receivers:
  awsfirehose:
    encoding: awscloudwatchmetricstreams_encoding
```

### cwlogs (deprecated)

The built-in `cwlogs` encoding is deprecated and will be removed in a future version.
Use the [`aws_logs_encoding`](../../extension/encoding/awslogsencodingextension) extension with
`format: cloudwatch` instead.

The receiver detects and decompresses gzip-compressed Firehose records before invoking any configured logs encoding.

```yaml
extensions:
  aws_logs_encoding:
    format: cloudwatch
receivers:
  awsfirehose:
    encoding: aws_logs_encoding
```

### otlp\_v1 (deprecated)

The built-in `otlp_v1` encoding is deprecated and will be removed in a future version.
Use the [`awscloudwatchmetricstreams_encoding`](../../extension/encoding/awscloudwatchmetricstreamsencodingextension)
extension with `format: opentelemetry1.0` instead.

```yaml
extensions:
  awscloudwatchmetricstreams_encoding:
    format: opentelemetry1.0
receivers:
  awsfirehose:
    encoding: awscloudwatchmetricstreams_encoding
```