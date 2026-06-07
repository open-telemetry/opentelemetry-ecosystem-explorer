package instrumentation

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAnalyzePackage(t *testing.T) {
	t.Run("analyzer - analyzes valid package with doc", func(t *testing.T) {
		tmpDir := t.TempDir()

		docContent := `// Package testpkg provides test instrumentation.
//
// This package instruments test operations.
package testpkg
`
		docPath := filepath.Join(tmpDir, "doc.go")
		if err := os.WriteFile(docPath, []byte(docContent), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if analysis == nil {
			t.Fatal("AnalyzePackage() returned nil")
		}

		if got := analysis.Name; got != "testpkg" {
			t.Errorf("Name = %v, want testpkg", got)
		}

		if got := analysis.Description; got == "" {
			t.Error("Description is empty")
		}
	})

	t.Run("analyzer - extracts telemetry with span kinds", func(t *testing.T) {
		tmpDir := t.TempDir()

		instrumentContent := `package testpkg

import (
	"context"
	"go.opentelemetry.io/otel/trace"
)

func InstrumentRequest(ctx context.Context, tracer trace.Tracer) {
	ctx, span := tracer.Start(ctx, "http.request", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()
}
`
		instrumentPath := filepath.Join(tmpDir, "instrument.go")
		if err := os.WriteFile(instrumentPath, []byte(instrumentContent), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 1 {
			t.Fatalf("Telemetry count = %d, want 1", got)
		}

		tel := analysis.Telemetry[0]
		if tel.When != "default" {
			t.Errorf("When = %v, want default", tel.When)
		}

		if got := len(tel.Spans); got != 1 {
			t.Fatalf("Spans count = %d, want 1", got)
		}

		span := tel.Spans[0]
		if span.Kind != SpanKindServer {
			t.Errorf("Span kind = %v, want SERVER", span.Kind)
		}
	})

	t.Run("analyzer - extracts semantic conventions from imports", func(t *testing.T) {
		tmpDir := t.TempDir()

		mainContent := `package testpkg

import (
	"go.opentelemetry.io/otel/semconv/v1.20.0"
	"go.opentelemetry.io/otel/trace"
)

func doSomething() {
	// Use semconv
	_ = semconv.HTTPMethodKey
}
`
		mainPath := filepath.Join(tmpDir, "main.go")
		if err := os.WriteFile(mainPath, []byte(mainContent), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require (
	go.opentelemetry.io/otel v1.38.0
	go.opentelemetry.io/otel/trace v1.38.0
)
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.SemanticConventions); got == 0 {
			t.Error("SemanticConventions is empty, expected at least one")
		}

		foundSemconv := false
		for _, conv := range analysis.SemanticConventions {
			if conv == "go.opentelemetry.io/otel/semconv/v1.20.0" {
				foundSemconv = true
				break
			}
		}

		if !foundSemconv {
			t.Errorf("SemanticConventions = %v, want to contain semconv import", analysis.SemanticConventions)
		}
	})

	t.Run("analyzer - handles package without telemetry", func(t *testing.T) {
		tmpDir := t.TempDir()

		mainContent := `package testpkg

func DoSomething() {}
`
		mainPath := filepath.Join(tmpDir, "main.go")
		if err := os.WriteFile(mainPath, []byte(mainContent), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 0 {
			t.Errorf("Telemetry count = %d, want 0", got)
		}
	})

	t.Run("analyzer - ignores non-tracer Start methods", func(t *testing.T) {
		tmpDir := t.TempDir()

		mainContent := `package testpkg

import (
	"go.opentelemetry.io/otel/metric"
)

func Start(opts ...Option) error {
	return nil
}

func Initialize(meter metric.Meter) error {
	return Start()
}

type Option func()
`
		mainPath := filepath.Join(tmpDir, "main.go")
		if err := os.WriteFile(mainPath, []byte(mainContent), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 0 {
			t.Errorf("Telemetry count = %d, want 0 (should not detect non-tracer Start as span)", got)
		}
	})

	t.Run("analyzer - handles non-existent package", func(t *testing.T) {
		tmpDir := t.TempDir()
		nonExistent := filepath.Join(tmpDir, "does-not-exist")

		_, err := AnalyzePackage(nonExistent)
		if err == nil {
			t.Error("AnalyzePackage() expected error for non-existent package, got nil")
		}
	})
}

func TestExtractTelemetry(t *testing.T) {
	t.Run("extractTelemetry - finds span and metric creation", func(t *testing.T) {
		tmpDir := t.TempDir()

		content := `package testpkg

import (
	"context"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

func instrument(ctx context.Context, tracer trace.Tracer, meter metric.Meter) {
	ctx, span := tracer.Start(ctx, "operation.name",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(attribute.String("http.method", "GET")))
	defer span.End()

	counter, _ := meter.Int64Counter("request.count")
	histogram, _ := meter.Float64Histogram("request.duration")
}
`
		filePath := filepath.Join(tmpDir, "test.go")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 1 {
			t.Fatalf("Telemetry count = %d, want 1", got)
		}

		tel := analysis.Telemetry[0]

		if got := len(tel.Spans); got != 1 {
			t.Fatalf("Spans count = %d, want 1", got)
		}

		span := tel.Spans[0]
		if span.Kind != SpanKindClient {
			t.Errorf("Span kind = %v, want CLIENT", span.Kind)
		}

		if got := len(span.Attributes); got < 1 {
			t.Errorf("Attributes count = %d, want at least 1", got)
		}

		foundHTTPMethod := false
		for _, attr := range span.Attributes {
			if attr.Name == "http.method" && attr.Type == AttributeTypeString {
				foundHTTPMethod = true
			}
		}
		if !foundHTTPMethod {
			t.Error("Expected http.method STRING attribute not found")
		}

		if got := len(tel.Metrics); got != 2 {
			t.Fatalf("Metrics count = %d, want 2", got)
		}

		foundCounter := false
		foundHistogram := false
		for _, metric := range tel.Metrics {
			if metric.Name == "request.count" && metric.Type == MetricTypeCounter {
				foundCounter = true
			}
			if metric.Name == "request.duration" && metric.Type == MetricTypeHistogram {
				foundHistogram = true
			}
		}

		if !foundCounter {
			t.Error("Expected request.count COUNTER metric not found")
		}
		if !foundHistogram {
			t.Error("Expected request.duration HISTOGRAM metric not found")
		}
	})
}

func TestExtractSemanticConventions(t *testing.T) {
	t.Run("extractSemanticConventions - finds semconv imports", func(t *testing.T) {
		tmpDir := t.TempDir()

		content := `package testpkg

import (
	"go.opentelemetry.io/otel/semconv/v1.20.0"
	"fmt"
)

func main() {
	fmt.Println(semconv.HTTPMethodKey)
}
`
		filePath := filepath.Join(tmpDir, "test.go")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		conventions := analysis.SemanticConventions
		if got := len(conventions); got == 0 {
			t.Error("extractSemanticConventions() found no conventions, want at least 1")
		}
	})

	t.Run("extractSemanticConventions - ignores non-semconv imports", func(t *testing.T) {
		tmpDir := t.TempDir()

		content := `package testpkg

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("hello")
	http.Get("url")
}
`
		filePath := filepath.Join(tmpDir, "test.go")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		conventions := analysis.SemanticConventions
		if got := len(conventions); got != 0 {
			t.Errorf("extractSemanticConventions() found %d conventions, want 0", got)
		}
	})
}

func TestExtractSpanSetAttributes(t *testing.T) {
	t.Run("extractSpans - captures SetAttributes after span creation", func(t *testing.T) {
		tmpDir := t.TempDir()

		content := `package testpkg

import (
	"context"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func instrument(ctx context.Context, tracer trace.Tracer) {
	ctx, span := tracer.Start(ctx, "operation", trace.WithSpanKind(trace.SpanKindServer))
	defer span.End()

	span.SetAttributes(
		attribute.String("custom.key", "value"),
		attribute.Int64("custom.count", 42),
		attribute.Bool("custom.flag", true),
	)
}
`
		filePath := filepath.Join(tmpDir, "test.go")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 1 {
			t.Fatalf("Telemetry count = %d, want 1", got)
		}

		tel := analysis.Telemetry[0]
		if got := len(tel.Spans); got != 1 {
			t.Fatalf("Spans count = %d, want 1", got)
		}

		span := tel.Spans[0]
		if got := len(span.Attributes); got < 3 {
			t.Errorf("Attributes count = %d, want at least 3", got)
		}

		foundString := false
		foundInt := false
		foundBool := false
		for _, attr := range span.Attributes {
			if attr.Name == "custom.key" && attr.Type == AttributeTypeString {
				foundString = true
			}
			if attr.Name == "custom.count" && attr.Type == AttributeTypeLong {
				foundInt = true
			}
			if attr.Name == "custom.flag" && attr.Type == AttributeTypeBoolean {
				foundBool = true
			}
		}

		if !foundString {
			t.Error("Expected custom.key STRING attribute not found")
		}
		if !foundInt {
			t.Error("Expected custom.count LONG attribute not found")
		}
		if !foundBool {
			t.Error("Expected custom.flag BOOLEAN attribute not found")
		}
	})
}

func TestExtractSpanAddEvent(t *testing.T) {
	t.Run("extractSpans - captures AddEvent with attributes", func(t *testing.T) {
		tmpDir := t.TempDir()

		content := `package testpkg

import (
	"context"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func instrument(ctx context.Context, tracer trace.Tracer) {
	ctx, span := tracer.Start(ctx, "operation", trace.WithSpanKind(trace.SpanKindClient))
	defer span.End()

	span.AddEvent("error.occurred", trace.WithAttributes(
		attribute.String("error.type", "timeout"),
		attribute.String("error.message", "connection timeout"),
	))
}
`
		filePath := filepath.Join(tmpDir, "test.go")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 1 {
			t.Fatalf("Telemetry count = %d, want 1", got)
		}

		tel := analysis.Telemetry[0]
		if got := len(tel.Spans); got != 1 {
			t.Fatalf("Spans count = %d, want 1", got)
		}

		span := tel.Spans[0]
		foundErrorType := false
		foundErrorMsg := false
		for _, attr := range span.Attributes {
			if attr.Name == "error.type" && attr.Type == AttributeTypeString {
				foundErrorType = true
			}
			if attr.Name == "error.message" && attr.Type == AttributeTypeString {
				foundErrorMsg = true
			}
		}

		if !foundErrorType {
			t.Error("Expected error.type STRING attribute from AddEvent not found")
		}
		if !foundErrorMsg {
			t.Error("Expected error.message STRING attribute from AddEvent not found")
		}
	})
}

func TestExtractMetricUnit(t *testing.T) {
	t.Run("extractMetrics - captures metric unit from WithUnit option", func(t *testing.T) {
		tmpDir := t.TempDir()

		content := `package testpkg

import (
	"go.opentelemetry.io/otel/metric"
)

func instrument(meter metric.Meter) {
	counter, _ := meter.Int64Counter("requests.total", metric.WithUnit("1"))
	histogram, _ := meter.Float64Histogram("request.duration", metric.WithUnit("ms"))
}
`
		filePath := filepath.Join(tmpDir, "test.go")
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		goModContent := `module example.com/testpkg

go 1.24

require go.opentelemetry.io/otel v1.38.0
`
		goModPath := filepath.Join(tmpDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		analysis, err := AnalyzePackage(tmpDir)
		if err != nil {
			t.Fatalf("AnalyzePackage() error = %v", err)
		}

		if got := len(analysis.Telemetry); got != 1 {
			t.Fatalf("Telemetry count = %d, want 1", got)
		}

		tel := analysis.Telemetry[0]
		if got := len(tel.Metrics); got != 2 {
			t.Fatalf("Metrics count = %d, want 2", got)
		}

		foundCounterUnit := false
		foundHistogramUnit := false
		for _, metric := range tel.Metrics {
			if metric.Name == "requests.total" && metric.Unit == "1" {
				foundCounterUnit = true
			}
			if metric.Name == "request.duration" && metric.Unit == "ms" {
				foundHistogramUnit = true
			}
		}

		if !foundCounterUnit {
			t.Error("Expected requests.total metric with unit '1' not found")
		}
		if !foundHistogramUnit {
			t.Error("Expected request.duration metric with unit 'ms' not found")
		}
	})
}

func TestGetSemConvMetrics(t *testing.T) {
	t.Run("getSemConvMetrics - returns runtime metrics", func(t *testing.T) {
		metrics := getSemConvMetrics("go.opentelemetry.io/contrib/instrumentation/runtime")

		if got := len(metrics); got != 8 {
			t.Fatalf("Runtime metrics count = %d, want 8", got)
		}

		expectedMetrics := map[string]struct {
			metric MetricType
			unit   string
		}{
			"go.memory.used":        {MetricTypeGauge, "By"},
			"go.memory.limit":       {MetricTypeGauge, "By"},
			"go.memory.allocated":   {MetricTypeCounter, "By"},
			"go.memory.allocations": {MetricTypeCounter, "{allocation}"},
			"go.memory.gc.goal":     {MetricTypeGauge, "By"},
			"go.goroutine.count":    {MetricTypeGauge, "{goroutine}"},
			"go.processor.limit":    {MetricTypeGauge, "{thread}"},
			"go.config.gogc":        {MetricTypeGauge, "%"},
		}

		for _, metric := range metrics {
			expected, ok := expectedMetrics[metric.Name]
			if !ok {
				t.Errorf("Unexpected metric: %s", metric.Name)
				continue
			}
			if metric.Type != expected.metric {
				t.Errorf("Metric %s type = %v, want %v", metric.Name, metric.Type, expected.metric)
			}
			if metric.Unit != expected.unit {
				t.Errorf("Metric %s unit = %v, want %v", metric.Name, metric.Unit, expected.unit)
			}
		}
	})

	t.Run("getSemConvMetrics - returns host metrics", func(t *testing.T) {
		metrics := getSemConvMetrics("go.opentelemetry.io/contrib/instrumentation/host")

		if got := len(metrics); got != 5 {
			t.Fatalf("Host metrics count = %d, want 5", got)
		}

		expectedMetrics := map[string]struct {
			metric MetricType
			unit   string
		}{
			"process.cpu.time":          {MetricTypeCounter, "s"},
			"system.cpu.time":           {MetricTypeCounter, "s"},
			"system.memory.usage":       {MetricTypeGauge, "By"},
			"system.memory.utilization": {MetricTypeGauge, "1"},
			"system.network.io":         {MetricTypeCounter, "By"},
		}

		for _, metric := range metrics {
			expected, ok := expectedMetrics[metric.Name]
			if !ok {
				t.Errorf("Unexpected metric: %s", metric.Name)
				continue
			}
			if metric.Type != expected.metric {
				t.Errorf("Metric %s type = %v, want %v", metric.Name, metric.Type, expected.metric)
			}
			if metric.Unit != expected.unit {
				t.Errorf("Metric %s unit = %v, want %v", metric.Name, metric.Unit, expected.unit)
			}
			if len(metric.Attributes) != 1 {
				t.Errorf("Metric %s attributes count = %d, want 1", metric.Name, len(metric.Attributes))
			}
		}
	})
}
