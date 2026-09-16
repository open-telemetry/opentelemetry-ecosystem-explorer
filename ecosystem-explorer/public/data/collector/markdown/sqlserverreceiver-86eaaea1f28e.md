## Required Permissions

### Windows Performance Counters

Make sure to run the collector as administrator in order to collect all performance counters for metrics.

### Direct Connection

When configured to directly connect to the SQL Server instance, the user must have the following permissions:

1. At least one of the following permissions:
- `CREATE DATABASE`
- `ALTER ANY DATABASE`
- `VIEW ANY DATABASE`

2. Permission to view server state:
   - SQL Server pre-2022: `VIEW SERVER STATE`
   - SQL Server 2022 and later: `VIEW SERVER PERFORMANCE STATE`

3. To collect the per-index physical stats metrics (`sqlserver.index.*`), the following two
   permissions are also required:
   - `CONNECT ANY DATABASE` — the receiver enters each user database to read its index
     physical stats; this grant lets the login connect to all current and future databases.
   - `VIEW ANY DEFINITION` — makes the index, object, and schema catalog views visible in
     every database so the physical stats query can resolve index metadata.

## Configuration

The following is a generic configuration that can be used for the default logs and metrics scraped
by the SQL Server receiver. A basic explanation on some of the fields has also been provided. For more
information, please reference the following section.

```yaml
sqlserver:
  collection_interval: 10s                     # interval for overall collection
  instance_name: CustomInstance
  username: myusername
  password: mypassword
  server: sqlserver.address
  port: 1433
  events:
    db.server.query_sample:
      enabled: true
    db.server.top_query:
      enabled: true
  top_query_collection:                        # this collection exports the most expensive queries as logs
    lookback_time: 60s                         # which time window should we look for the top queries
    max_query_sample_count: 1000               # maximum number query we store in cache for top queries.
    top_query_count: 250                       # The maximum number of active queries to report in a single run.
    collection_interval: 60s                   # collection interval for top query collection specifically
  query_sample_collection:                     # this collection exports the currently (relate to the query time) executing queries as logs
    max_rows_per_query: 100                    # the maximum number of samples to return for one single query.
```

The following settings are optional:
- `collection_interval` (default = `10s`): The interval at which metrics should be emitted by this receiver.
- `instance_name` (optional): The instance name identifies the specific SQL Server instance being monitored.
  If unspecified, metrics will be scraped from all instances. If configured, the `computer_name` must also be set
  when running on Windows.

Direct connection options (optional, but all must be specified to enable):
- `username`: The username used to connect to the SQL Server instance.
- `password`: The password used to connect to the SQL Server instance.
- `server`: IP Address or hostname of SQL Server instance to connect to.
- `port`: Port of the SQL Server instance to connect to.

For finer control over the direct connection use the `datasource`, a.k.a. the "connection string", instead.
Note: it can't be used in conjunction with the `username`, `password`, `server` and `port` options.

When a direct connection is used, all scrapers created for a signal share a single database connection pool
instead of each opening its own. The pool is scoped per receiver instance: if this receiver is used in both a
metrics and a logs pipeline, the metrics and logs receivers each own a separate pool. The pool can be tuned
with the `connection_pool` options (all optional):
- `max_open` (default = number of scrapers): The maximum number of open connections to the database. `0` means unlimited.
- `max_idle` (default = number of scrapers): The maximum number of idle connections kept in the pool.
- `max_lifetime` (optional, example = `5m`, default = unset): The maximum amount of time a connection may be reused. `0` means connections are reused forever.
- `max_idle_time` (optional, example = `1m`, default = unset): The maximum amount of time a connection may be idle before being closed. `0` means idle connections are not closed due to idle time.

The defaults are derived from the number of enabled scrapers so that every scraper can query concurrently
while keeping the total number of connections bounded. Most deployments do not need to set these; tune them
only when connecting to an instance with strict connection limits or a large number of enabled scrapers.

Windows-specific options:
- `computer_name` (optional): The computer name identifies the SQL Server name or IP address of the computer being monitored.
  If specified, `instance_name` is also required to be defined. This option is ignored in non-Windows environments.

Top-Query collection specific options (only useful when top-query collection are enabled):
- `lookback_time` (optional, example = `60s`, default = `2 * collection_interval`): The time window (in second) in which to query for top queries.
  - Queries that were finished execution outside the lookback window are not included in the collection. Increasing the lookback window (in seconds) will be useful for capturing long-running queries.
- `max_query_sample_count` (optional, example = `5000`, default = `1000`): The maximum number of records to fetch in a single run.
- `top_query_count`: (optional, example = `100`, default = `250`): The maximum number of active queries to report (to the next consumer) in a single run.
- `collection_interval`: (optional, default = `60s`): The interval at which top queries should be emitted by this receiver.
  - This value can only guarantee that the top queries are collected at most once in this interval.
    - For instance, you have global `collection_interval` as `10s` and `top_query_collection.collection_interval` as `60s`.
      - In this case, the default receiver scraper will still try to run in every 10 seconds.
      - However, the top queries collection will only run after 60 seconds have passed since the last collection.
    - For instance, you have global `collection_interval` as `10s` and `top_query_collection.collection_interval` as `5s`.
      - In this case, `top_query_collection.collection_internal` will make no effects to the collection

Query sample collection related options (only useful when query sample is enabled)
- `max_rows_per_query`: (optional, default = `100`) use this to limit rows returned by the sampling query.
Example:

```yaml
    receivers:
      sqlserver:
        collection_interval: 10s
      sqlserver/1:
        collection_interval: 5s
        username: sa
        password: securepassword
        server: 0.0.0.0
        port: 1433
```

When a named instance is used on Windows, a computer name and an instance name must be specified.
Example with named instance:

```yaml
    receivers:
      sqlserver:
        collection_interval: 10s
        computer_name: CustomServer
        instance_name: CustomInstance
        resource_attributes:
          sqlserver.computer.name:
            enabled: true
          sqlserver.instance.name:
            enabled: true
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with detailed sample configurations in [testdata/config.yaml](./testdata/config.yaml).

Top query collection enabled:
```yaml
    receivers:
      sqlserver:
        collection_interval: 5s
        username: sa
        password: securepassword
        server: 0.0.0.0
        port: 1433
        top_query_collection:
          lookback_time: 60s
          max_query_sample_count: 1000
          top_query_count: 200
        query_sample_collection:
          max_rows_per_query: 1450
```

## Feature Gate

A new feature gate was added in `v0.129.0` for removing the `server.address` and `server.port` 
resource attributes, as they are not identified as resources attributes in the semantic conventions.
To enable it, pass the following argument to the Collector:

```
--feature-gates=receiver.sqlserver.RemoveServerResourceAttribute
```

## Metrics

Details about the metrics produced by this receiver can be found in [documentation.md](./documentation.md)


## Logs 

Details about the logs produced by this receiver can be found in [logs-documentation.md](./logs-documentation.md)

## Known issues
SQL Server docker users may run into an issue that the collector fails to parse certificate from server due to `x509: negative serial number`. That's because we adopted Go `1.23` starting from contrib `v0.121.0`:
> Before Go 1.23, ParseCertificate accepted certificates with negative serial numbers.
> This behavior can be restored by including "x509negativeserial=1" in the GODEBUG environment variable.
references:
1. https://pkg.go.dev/crypto/x509#ParseCertificate
2. https://github.com/microsoft/mssql-docker/issues/895

## Troubleshooting

### `service.instance.id` is `unknown:1433`

In a rare case, the `service.instance.id` resource attribute is set to `unknown:1433`. This is because the receiver is unable to parse and compute the `service.instance.id` resource attribute.

You can file an issue that includes your configuration to help us investigate the issue.
