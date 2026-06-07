package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
)

const serviceName = "otelhttp-exemplar"

func main() {
	ctx := context.Background()

	shutdown, err := setupOTelSDK(ctx)
	if err != nil {
		slog.Error("failed to set up OTel SDK", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := shutdown(ctx); err != nil {
			slog.Error("failed to shut down OTel SDK", "error", err)
		}
	}()

	logger := otelslog.NewLogger(serviceName)
	slog.SetDefault(logger)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		slog.Error("failed to listen", "error", err)
		os.Exit(1)
	}
	addr := ln.Addr().String()

	mux := http.NewServeMux()
	mux.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		slog.InfoContext(r.Context(), "handling request", "path", r.URL.Path)
		fmt.Fprintln(w, "hello, world")
	})

	handler := otelhttp.NewHandler(mux, serviceName)
	srv := &http.Server{Handler: handler}

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
		}
	}()

	transport := otelhttp.NewTransport(http.DefaultTransport)
	client := &http.Client{Transport: transport}

	tracer := otel.Tracer(serviceName)
	ctx, span := tracer.Start(ctx, "client-request")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+addr+"/hello", nil)
	if err != nil {
		span.End()
		slog.Error("failed to create request", "error", err)
		os.Exit(1)
	}

	resp, err := client.Do(req)
	if err != nil {
		span.End()
		slog.Error("request failed", "error", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) //nolint:errcheck

	slog.InfoContext(ctx, "request complete", "status", resp.StatusCode)
	span.End()

	time.Sleep(4 * time.Second)

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}
}
