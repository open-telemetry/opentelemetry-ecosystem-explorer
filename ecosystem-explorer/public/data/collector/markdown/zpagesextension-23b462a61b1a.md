Enables an extension that serves zPages, an HTTP endpoint that provides live
data for debugging different components that were properly instrumented for such.
All core exporters and receivers provide some zPage instrumentation.

zPages are useful for in-process diagnostics without having to depend on any
backend to examine traces or metrics.

The following settings are required:

- `endpoint` (default = localhost:55679): Specifies the HTTP endpoint that serves
zPages. Use localhost:<port> to make it available only locally, or ":<port>" to
make it available on all network interfaces.

The following settings can be optionally configured:

- `expvar`
  - `enabled` (default = false): Enable the expvar services. For detail see [ExpvarZ](#expvarz).

Example:
```yaml
extensions:
  zpages:
```

The full list of settings exposed for this extension are documented [here](./config.go)
with detailed sample configurations [here](./testdata/config.yaml).

## Exposed zPages routes

The collector exposes the following zPage routes:

### ServiceZ

ServiceZ gives an overview of the collector services and quick access to the
`pipelinez`, `extensionz`, and `featurez` zPages.  The page also provides build
and runtime information.

Example URL: http://localhost:55679/debug/servicez

### PipelineZ

PipelineZ brings insight on the running pipelines running in the collector. You can
find information on type, if data is mutated and the receivers, processors and exporters
that are used for each pipeline.

Example URL: http://localhost:55679/debug/pipelinez

### ExtensionZ

ExtensionZ shows the extensions that are active in the collector.

Example URL: http://localhost:55679/debug/extensionz

### FeatureZ

FeatureZ lists the feature gates available along with their current status
and description.

Example URL: http://localhost:55679/debug/featurez

### TraceZ
The TraceZ route is available to examine and bucketize spans by latency buckets for
example

(0us, 10us, 100us, 1ms, 10ms, 100ms, 1s, 10s, 1m]
They also allow you to quickly examine error samples

Example URL: http://localhost:55679/debug/tracez

### ExpvarZ

The ExpvarZ exposes the useful information about Go runtime, OTel components could leverage [expvar](https://pkg.go.dev/expvar) library to expose their own state.

Example URL: http://localhost:55679/debug/expvarz

## Warnings

This extension registers a SpanProcessor to record all the spans created inside
the Collector. This depends on a TracerProvider that supports
the SDK methods RegisterSpanProcessor and UnregisterSpanProcessor. Setting
`service::telemetry::traces::level` to `none` configures a No-Op
TracerProvider that does not support these methods, and therefore the zPages
extension cannot work in this mode.
