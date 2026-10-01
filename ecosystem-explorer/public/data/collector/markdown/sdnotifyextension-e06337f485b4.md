The `sd_notify` extension integrates the collector with the [sd_notify(3)](https://www.man7.org/linux/man-pages/man3/sd_notify.3.html) protocol.

When running under a `Type=notify` (or `Type=notify-reload`) systemd unit, the collector will:

- Send `READY=1` once all pipelines have started.
- Send `STOPPING=1` when the process is shutting down after receiving `SIGINT` or
  `SIGTERM`, so systemd knows the shutdown is intentional.
- (only for `Type=notify-reload`) On `SIGHUP` send `RELOADING=1` (paired with `MONOTONIC_USEC` as required by
  `sd_notify(3)`) so systemd's state machine correctly reflects that a reload is in progress.
  The extension doesn't itself drive a reload or cycle the process on `SIGHUP`.
  The OpenTelemetry Collector has [its own `SIGHUP` handler](https://github.com/open-telemetry/opentelemetry-collector/blob/259f177f8c1aea6f1a98c0a23ef1817c88afeb92/otelcol/collector.go#L476-L483)
  that performs an **in-process** reload.
- When systemd has set `WATCHDOG_USEC` for the collector's PID, send
  `WATCHDOG=1` keep-alive notifications every `WATCHDOG_USEC / 2` as recommended
  by [sd_watchdog_enabled(3)](https://www.man7.org/linux/man-pages/man3/sd_watchdog_enabled.3.html),
  for as long as the collector is running, so systemd can restart the process if it hangs.

> It is recommended that a daemon sends a keep-alive notification message to the service manager every half of the time returned here.

**NOTE**: When `$NOTIFY_SOCKET` is not set the extension logs a warning and stays a no-op — it will never fail collector startup.

## Configuration

The extension takes no configuration:

```yaml
extensions:
  sd_notify: {}

service:
  extensions: [sd_notify]
```

## Example systemd unit

```ini
[Unit]
Description=OpenTelemetry Collector
After=network-online.target

[Service]
Type=notify-reload
ExecStart=/usr/local/bin/otelcol --config=/etc/otelcol/config.yaml
WatchdogSec=30s
Restart=always
RestartSec=2s

[Install]
WantedBy=multi-user.target
```

## Development

Unit and integration tests are tagged with `//go:build linux`, because systemd
is primarily used in Linux. This means that if you try to run them, they will 
be skipped if you use a non-Linux machine (MacOS, FreeBSD, Windows, etc.). To
overcome that you can remove the directives and run the tests locally. Keep in
mind that you need [Docker](https://www.docker.com) installed on your machine in
order to run the integration tests, because they use [Testcontainers](https://golang.testcontainers.org).
Use the command below to run both unit and integration tests.

```bash
make test mod-integration-test
```
