The Remote Tap processor, which can be positioned anywhere in a pipeline, allows
data to pass through to the next component. Simultaneously, it makes a portion
of the data accessible to WebSocket clients connecting on a configurable port.
This functionality resembles that of the Unix `tee` command, which enables data
to flow through while duplicating and redirecting it for inspection.

To avoid overloading clients, the amount of telemetry duplicated over 
any open WebSockets is rate limited by an adjustable amount.

## Config

The Remote Tap processor has two configurable fields: `endpoint` and `limit`:

- `endpoint`: The endpoint on which the WebSocket processor listens. Optional. Defaults
  to `localhost:12001`.
  See our [security best practices doc](https://opentelemetry.io/docs/security/config-best-practices/#protect-against-denial-of-service-attacks) to understand how to set the endpoint in different environments.

- `limit`: The rate limit over the WebSocket in messages per second. Can be a
  float or an integer. Optional. Defaults to `1`.

Example configuration:

```yaml
processors:
  remotetap:
    endpoint: 0.0.0.0:12001
    limit: 1 # rate limit 1 msg/sec
```
