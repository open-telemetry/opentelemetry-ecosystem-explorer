## Configuration options

The following settings can be optionally configured:

- `dsn` The Cassandra server DSN (Data Source Name), for example `127.0.0.1`.
  reference: [github.com/apache/cassandra-gocql-driver/v2](https://github.com/apache/cassandra-gocql-driver/)
- `port` (default = 9042): The Cassandra server port
- `timeout` (default = 10s): The Cassandra server connection timeout
- `keyspace` (default = otel): The keyspace name.
- `trace_table` (default = otel_spans): The table name for traces.
- `replication` (default = class: SimpleStrategy, replication_factor: 1): The strategy of
  replication. https://cassandra.apache.org/doc/4.1/cassandra/architecture/dynamo.html#replication-strategy
- `compression` (default = LZ4Compressor): https://cassandra.apache.org/doc/4.0/cassandra/operating/compression.html
- `auth` (default = username: "", password: "") Authorization for the Cassandra.

## Example

```yaml
exporters:
  cassandra:
    dsn: 127.0.0.1
    port: 9042
    timeout: 10s
    keyspace: "otel"
    trace_table: "otel_spans"
    replication:
      class: "SimpleStrategy"
      replication_factor: 1
    compression:
      algorithm: "ZstdCompressor"
    auth:
      username: "your-username"
      password: "your-password"
```
