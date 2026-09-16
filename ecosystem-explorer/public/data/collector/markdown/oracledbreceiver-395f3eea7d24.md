## Getting Started

To use the Oracle DB receiver you must define how to connect to your DB. This can be done in two ways,
defined in the [Primary](#primary-configuration-option) and [Secondary](#secondary-configuration-option) configuration
option sections. Defining one of the two configurations is required. If both are defined, the primary
option will be used.

### Primary Configuration Option

Required options:
- `datasource`: Oracle database connection string. Special characters must be encoded. Refer to [Oracle Go Driver go_ora documentation](https://github.com/sijms/go-ora) for full connection string options.

Example:

```yaml
receivers:
  oracledb:
    datasource: "oracle://otel:password@localhost:51521/XE"
```

### Secondary Configuration Option

Required options:
- `endpoint`: Endpoint used to connect to the Oracle DB server. Must be in the format of `host:port`
- `password`: Password for the Oracle DB connection. Special characters are allowed.
- `service`: Oracle DB service that the receiver should connect to.
- `username`: Username for the Oracle DB connection.

Example:
```yaml
receivers:
  oracledb:
    endpoint: localhost:51521
    password: p@sswo%d
    service: XE
    username: otel
```

### Optional Configuration Options

- `collection_interval` (default = `10s`): The interval at which metrics should be emitted by this receiver.
- `initial_delay` (default = `1s`): The initial time period this receiver waits before starting.
- `timeout` (default = `0`): Timeout for each Oracle DB request. Disabled by default.

## Permissions

### Instance detection

These grants are required to populate the `oracle.db.version`, `oracle.db.role`,
`oracle.db.open_mode`, and `oracle.db.pdb` resource attributes.
Detection is best-effort; failures are logged at warn level and the receiver continues.

```sql
GRANT SELECT ON V_$INSTANCE TO <username>;
GRANT SELECT ON V_$DATABASE TO <username>;
```

> **Note:** `sys_context('USERENV', ...)` queries against `DUAL` require no
> additional grant and are available to all database users.

### Hosting type detection (Oracle >=19c only)

These grants are required to populate the `oracle.db.hosting_type` resource attribute.
Only applies to Oracle 19c and later. Detection is best-effort; failures are logged at
warn level and the receiver continues.

```sql
GRANT SELECT ON V_$DATAFILE TO <username>;
GRANT SELECT ON V_$PDBS TO <username>;        -- OCI detection, connected to PDB only
GRANT SELECT ON CDB_SERVICES TO <username>;   -- OCI confirmation, connected to PDB only
```

### Metrics collection

Depending on which metrics you collect, you will need to assign these
permissions to the database user:

```sql
GRANT SELECT ON V_$SESSION TO <username>;
GRANT SELECT ON V_$SYSSTAT TO <username>;
GRANT SELECT ON V_$RESOURCE_LIMIT TO <username>;
GRANT SELECT ON DBA_TABLESPACES TO <username>;
GRANT SELECT ON DBA_DATA_FILES TO <username>;
GRANT SELECT ON DBA_TABLESPACE_USAGE_METRICS TO <username>;
```

## Enabling metrics.

See [documentation](./documentation.md).

You can enable or disable selective metrics.

Example:

```yaml
receivers:
  oracledb:
    datasource: "oracle://otel:password@localhost:51521/XE"
    metrics:
      oracledb.query.cpu_time:
        enabled: false
      oracledb.query.physical_read_requests:
        enabled: true
```

## Enabling events.


The following is a generic configuration that can be used for the default logs and metrics scraped
by the Oracle DB receiver.

```yaml
receivers:
  oracledb:
    collection_interval: 10s                     # interval for overall collection
    datasource: "oracle://otel:password@localhost:51521/XE"
    events:
      db.server.query_sample:
        enabled: true
      db.server.top_query:
        enabled: true
    top_query_collection:                        # this collection exports the most expensive queries as logs
      max_query_sample_count: 1000               # maximum number of samples collected from db to filter the top N
      top_query_count: 200                       # The maximum number of queries (N) for which the metrics would be reported
      collection_interval: 60s                   # collection interval for top query collection specifically
    query_sample_collection:                     # this collection exports the currently (relate to the query time) executing queries as logs
      max_rows_per_query: 100                     # the maximum number of samples to bre reported.
```