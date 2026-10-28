The extension requires read and write access to a Redis cluster.

## Config
- `endpoint` (required): The endpoint of the redis instance to connect to. Default: `localhost:6379`
- `password` (optional): The password to connect to the redis instance. Default: ``
- `db` (optional): Database to be selected after connecting to the server. Default: 0
- `expiration` (optional): TTL for all storage entries. Default TTL means the key has no expiration time. Default: 0
- `prefix` (optional): The prefix used for the redis key. If specified, it will be appended to the default as follows: `_<prefix>`. Default: `<component_kind>_<component_type>_<component_name>_<storage_extension_name>`.
- `tls`:
  - `insecure` (default = false): whether to disable client transport security for the exporter's connection.
  - `ca_file`: path to the CA cert. For a client this verifies the server certificate. Should only be used if `insecure` is set to false.
  - `cert_file`: path to the TLS cert to use for TLS required connections. Should only be used if `insecure` is set to false.
  - `key_file`: path to the TLS key to use for TLS required connections. Should only be used if `insecure` is set to false.

## Atomic counters

Besides the standard storage client interface, the client returned by this extension provides atomic integer counters that can be shared across Collector instances:

```go
IncrementBy(ctx context.Context, key string, delta int64) (int64, error)
BatchIncrementBy(ctx context.Context, deltas map[string]int64) (map[string]int64, error)
```

Both return the value after incrementing. A missing key counts as 0 and `delta` may be negative.

### Using counters from a component

These methods are not part of the storage interface defined in the Collector core, so a component reaches
them with a type assertion against an interface it defines itself. It does not need to import this module.

```go
// Declare only the methods you use. The signatures must match exactly,
// otherwise the type assertion below returns false.
type incrementer interface {
	IncrementBy(ctx context.Context, key string, delta int64) (int64, error)
}

func (c *myComponent) Start(ctx context.Context, host component.Host) error {
	ext, ok := host.GetExtensions()[*c.cfg.StorageID]
	if !ok {
		return fmt.Errorf("storage extension %q not found", c.cfg.StorageID)
	}
	se, ok := ext.(storage.Extension)
	if !ok {
		return fmt.Errorf("extension %q is not a storage extension", c.cfg.StorageID)
	}
	client, err := se.GetClient(ctx, component.KindProcessor, c.id, "")
	if err != nil {
		return err
	}
	inc, ok := client.(incrementer)
	if !ok {
		return fmt.Errorf("storage extension %q does not support atomic counters", c.cfg.StorageID)
	}
	c.counters = inc
	return nil
}

func (c *myComponent) countRequest(ctx context.Context) error {
	total, err := c.counters.IncrementBy(ctx, "requests", 1)
	if err != nil {
		return err // not idempotent, see below before retrying
	}
	c.logger.Debug("requests so far", zap.Int64("total", total))
	return nil
}
```

Instead of returning an error when the assertion fails, a component can fall back to `Get` and `Set`,
which are not atomic across instances.

Point the component at the extension in the configuration:

```yaml
extensions:
  redis_storage:
    endpoint: localhost:6379

processors:
  my_processor:
    storage: redis_storage

service:
  extensions: [redis_storage]
```

### Behavior

- Counters are stored as decimal strings, so `Get` returns bytes such as `"42"`.
- When `expiration` is set, the TTL is applied to any counter that has none, normally only when it is created.
  It is not refreshed by later increments.
- Increments are atomic per key, not across keys. On error some increments may already be applied, so callers
  must not blindly retry. A failure to set the TTL is logged and does not fail the call.

## Example

```yaml
extensions:
  redis_storage:
  redis_storage/all_settings:
    endpoint: localhost:6379
    password: ""
    db: 0
    expiration: 5m
    prefix: test_
    tls:
      insecure: true

service:
  extensions: [redis_storage, redis_storage/all_settings]
  pipelines:
    traces:
      receivers: [nop]
      exporters: [nop]

# Data pipeline is required to load the config.
receivers:
  nop:
exporters:
  nop:
```
