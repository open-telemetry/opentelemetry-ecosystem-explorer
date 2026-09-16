Note: The current metrics receiver only supports receiving JVM data.

## Prerequisites

This receiver supports [Apache Skywalking-Java Agent](https://github.com/apache/skywalking-java) version 8.9.0+

## Getting Started

By default, the Skywalking receiver will not serve any protocol. A protocol must be
named under the `protocols` object for the Skywalking receiver to start. The
below protocols are supported, each supports an optional `endpoint`
object configuration parameter.

- `grpc` (default `endpoint` = localhost:11800)
- `http` (default `endpoint` = localhost:12800)

See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.


Examples:

```yaml
receivers:
  skywalking:
    protocols:
      grpc:
        endpoint: 0.0.0.0:11800
      http:
        endpoint: 0.0.0.0:12800

service:
  pipelines:
    traces:
      receivers: [skywalking]
    metrics:
      receivers: [skywalking]

```

## Semantic Convention Migration

A feature gate `translator.skywalking.useStableSemconv` controls the migration
from legacy to stable semantic conventions (v1.38.0).

To opt-in to the new semantic conventions, enable the gate:
`--feature-gates translator.skywalking.useStableSemconv`

When enabled, the following output attribute names will change:
- `http.url` is now `url.full`
- `http.status_code` is now `http.response.status_code`
- `db.system` is now `db.system.name`
- `db.name` is now `db.namespace`
- `net.peer.name` is now `server.address`

This affects the Skywalking receiver and Skywalking encoding extension.

See migration guides:
- https://opentelemetry.io/docs/specs/semconv/non-normative/http-migration/
- https://opentelemetry.io/docs/specs/semconv/non-normative/db-migration/
