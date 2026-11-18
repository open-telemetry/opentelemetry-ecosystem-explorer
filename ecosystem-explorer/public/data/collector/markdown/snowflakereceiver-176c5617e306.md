## Configuration

The following settings are required:

* `username` (no default): Specifies username used to authenticate with Snowflake.
* `password` (no default): Specifies the password associated with designated username. Used to authenticate with Snowflake.
* `account` (no default): Specifies the account from which metrics are to be gathered.
* `warehouse` (no default): Specifies the warehouse, or unit of computer, designated for the metric gathering queries. Must be an existing warehouse in your Snowflake account.

The following settings are optional:

* `metrics` (default: see [`DefaultMetricSettings`](./internal/metadata/generated_metrics.go)): Controls the enabling/disabling of specific metrics. See [in-depth documentation on the allowable metrics](./documentation.md).
* `schema` (default: 'ACCOUNT_USAGE'): Snowflake DB schema containing usage statistics and metadata to be monitored.
* `database` (default: 'SNOWFLAKE'): Snowflake DB containing schema with usage statistics and metadata to be monitored.
* `role` (default: 'ACCOUNTADMIN'): Role associated with the username designated above. By default admin privileges are required to access most/all of the usage data.
* `collection_interval` (default: 30m): Collection interval for metrics receiver. The value for this setting must be readable by golang's [time.ParseDuration](https://pkg.go.dev/time#ParseDuration).

Example:
```yaml
receivers:
  snowflake:
    username: snowflakeuser
    password: securepassword
    account: bigbusinessaccount
    warehouse: metricWarehouse
    collection_interval: 5m
    metrics:
      snowflake.database.bytes_scanned.avg:
        enabled: true
      snowflake.query.bytes_deleted.avg:
        enabled: false
```

The full list of settings exposed for this receiver are documented in [config.go](./config.go) with a detailed sample configuration in [testdata/config.yaml](./testdata/config.yaml)
