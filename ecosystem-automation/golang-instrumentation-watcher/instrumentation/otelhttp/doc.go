// Command otelhttp is a self-contained exemplar that exercises the
// [go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp] library
// end-to-end and prints the resulting telemetry to stdout.
//
// This exemplar demonstrates two OTel contrib libraries: otelhttp and the
// [go.opentelemetry.io/contrib/bridges/otelslog] log bridge. Running the
// harness produces real spans, metrics, and logs so the instrumentation can be
// observed in isolation.
//
// # What it does
//
// The program performs a single round trip against itself:
//
//   - setupOTelSDK (otel.go) installs stdout exporters for traces, metrics, and
//     logs, plus a W3C TraceContext + Baggage propagator, and returns a combined
//     shutdown function.
//   - An HTTP server bound to an ephemeral loopback port (127.0.0.1:0) serves
//     /hello through an [otelhttp.NewHandler], which produces the server-side
//     span and metrics.
//   - An [http.Client] using an [otelhttp.NewTransport] issues one GET to /hello.
//     A manually started "client-request" span parents the transport's
//     client-side span, and TraceContext propagation links it to the server span.
//   - Request handling logs through an [otelslog] logger, so the log records
//     carry the active trace and span IDs.
//
// After the request completes the program sleeps briefly so the batch and
// periodic exporters flush, then shuts the server and SDK down cleanly. All
// telemetry is written to stdout; there is no external collector.
//
// # Running
//
//	go run .
//
// Output is non-deterministic (timestamps, durations, randomly assigned port and
// IDs), so this exemplar is meant for manual inspection rather than golden-file
// assertions.
package main
