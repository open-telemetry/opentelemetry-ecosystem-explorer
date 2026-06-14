package instrumentation

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/repo"
	"gopkg.in/yaml.v3"
)

func TestMain(m *testing.M) {
	wd, err := os.Getwd()
	if err != nil {
		panic("Failed to resolve working directory: " + err.Error())
	}
	if _, err := repo.Checkout(wd); err != nil {
		panic("Failed to checkout repos: " + err.Error())
	}

	os.Exit(m.Run())
}

func getRepoPath(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	return filepath.Join(wd, ".repo/opentelemetry-go-contrib")
}

func assertSpanHasAttribute(t *testing.T, attributes []Attribute, name string) {
	t.Helper()
	for _, attr := range attributes {
		if attr.Name == name {
			return
		}
	}
	t.Errorf("Span missing required attribute %s", name)
}

func TestAWSSDKInstrumentation(t *testing.T) {
	repoPath := getRepoPath(t)
	analysis, err := AnalyzePackage(filepath.Join(repoPath, "instrumentation/github.com/aws/aws-sdk-go-v2/otelaws"))
	if err != nil {
		t.Fatalf("AnalyzePackage() error = %v", err)
	}

	if got := len(analysis.Telemetry); got != 1 {
		t.Fatalf("Telemetry sections = %d, want 1", got)
	}

	tel := analysis.Telemetry[0]

	if got := len(tel.Spans); got == 0 {
		t.Fatal("Expected spans but got 0")
	}

	var hasClientSpan bool
	for _, span := range tel.Spans {
		if span.Kind == SpanKindClient {
			hasClientSpan = true
			assertSpanHasAttribute(t, span.Attributes, "rpc.system")
			assertSpanHasAttribute(t, span.Attributes, "rpc.service")
			assertSpanHasAttribute(t, span.Attributes, "rpc.method")
			break
		}
	}
	if !hasClientSpan {
		t.Errorf("No CLIENT span found, got spans: %+v", tel.Spans)
	}
}

func TestGinInstrumentation(t *testing.T) {
	repoPath := getRepoPath(t)
	analysis, err := AnalyzePackage(filepath.Join(repoPath, "instrumentation/github.com/gin-gonic/gin/otelgin"))
	if err != nil {
		t.Fatalf("AnalyzePackage() error = %v", err)
	}

	if got := len(analysis.Telemetry); got != 1 {
		t.Fatalf("Telemetry sections = %d, want 1", got)
	}

	tel := analysis.Telemetry[0]

	if got := len(tel.Spans); got != 1 {
		t.Fatalf("Spans count = %d, want 1", got)
	}

	span := tel.Spans[0]
	if span.Kind != SpanKindServer {
		t.Errorf("Span kind = %v, want %s", span.Kind, SpanKindServer)
	}

	assertSpanHasAttribute(t, span.Attributes, "http.request.method")
	assertSpanHasAttribute(t, span.Attributes, "http.response.status_code")
	assertSpanHasAttribute(t, span.Attributes, "http.route")

	if got := len(tel.Metrics); got != 3 {
		t.Errorf("Metrics count = %d, want 3", got)
	}
}

func TestGRPCInstrumentation(t *testing.T) {
	repoPath := getRepoPath(t)
	analysis, err := AnalyzePackage(filepath.Join(repoPath, "instrumentation/google.golang.org/grpc/otelgrpc"))
	if err != nil {
		t.Fatalf("AnalyzePackage() error = %v", err)
	}

	if got := len(analysis.Telemetry); got != 1 {
		t.Fatalf("Telemetry sections = %d, want 1", got)
	}

	tel := analysis.Telemetry[0]

	if got := len(tel.Metrics); got != 3 {
		t.Errorf("Metrics count = %d, want 3", got)
	}
}

func TestMongoInstrumentation(t *testing.T) {
	repoPath := getRepoPath(t)
	analysis, err := AnalyzePackage(filepath.Join(repoPath, "instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"))
	if err != nil {
		t.Fatalf("AnalyzePackage() error = %v", err)
	}

	if got := len(analysis.Telemetry); got != 1 {
		t.Fatalf("Telemetry sections = %d, want 1", got)
	}

	tel := analysis.Telemetry[0]

	if got := len(tel.Spans); got != 1 {
		t.Fatalf("Spans count = %d, want 1", got)
	}

	span := tel.Spans[0]
	if span.Kind != SpanKindClient {
		t.Errorf("Span kind = %v, want CLIENT", span.Kind)
	}

	assertSpanHasAttribute(t, span.Attributes, "db.system")
	assertSpanHasAttribute(t, span.Attributes, "db.operation.name")
}

func TestRestfulInstrumentation(t *testing.T) {
	repoPath := getRepoPath(t)
	analysis, err := AnalyzePackage(filepath.Join(repoPath, "instrumentation/github.com/emicklei/go-restful/otelrestful"))
	if err != nil {
		t.Fatalf("AnalyzePackage() error = %v", err)
	}

	if got := len(analysis.Telemetry); got != 1 {
		t.Fatalf("Telemetry sections = %d, want 1", got)
	}

	tel := analysis.Telemetry[0]

	if got := len(tel.Spans); got != 1 {
		t.Fatalf("Spans count = %d, want 1", got)
	}

	span := tel.Spans[0]
	if span.Kind != SpanKindServer {
		t.Errorf("Span kind = %v, want %s", span.Kind, SpanKindServer)
	}

	assertSpanHasAttribute(t, span.Attributes, "http.request.method")
	assertSpanHasAttribute(t, span.Attributes, "http.response.status_code")

	if got := len(tel.Metrics); got != 3 {
		t.Errorf("Metrics count = %d, want 3", got)
	}
}

func TestLambdaInstrumentation(t *testing.T) {
	repoPath := getRepoPath(t)
	analysis, err := AnalyzePackage(filepath.Join(repoPath, "instrumentation/github.com/aws/aws-lambda-go/otellambda"))
	if err != nil {
		t.Fatalf("AnalyzePackage() error = %v", err)
	}

	if got := len(analysis.Telemetry); got != 1 {
		t.Fatalf("Telemetry sections = %d, want 1", got)
	}

	tel := analysis.Telemetry[0]

	if got := len(tel.Spans); got == 0 {
		t.Fatal("Expected spans but got 0")
	}
}

func TestFullScanValidation(t *testing.T) {
	t.Run("scan covers instrumentation and bridges", func(t *testing.T) {
		repoPath := getRepoPath(t)
		result, err := ScanRepo(repo.RepoContrib, repoPath)
		if err != nil {
			t.Fatalf("ScanRepo() error = %v", err)
		}

		// instrumentation(14) + bridges(5) = 19 libraries (minus any that lack
		// a contrib module path). Pipeline-config dirs (exporters, propagators,
		// samplers, detectors, processors) are intentionally out of scope.
		if got := len(result.Libraries); got < 19 {
			t.Errorf("Library count = %d, want at least 19 (instrumentation+bridges)", got)
		}

		// All library Names must be globally unique.
		seen := make(map[string]string)
		for _, lib := range result.Libraries {
			if prev, ok := seen[lib.Name]; ok {
				t.Errorf("Duplicate Name %q: module %s and %s", lib.Name, prev, lib.Module.Path)
			}
			seen[lib.Name] = lib.Module.Path
		}

		t.Logf("Total libraries scanned: %d", len(result.Libraries))
	})
}

// TestScanRepoDeterministic guards the content-addressed contract: repeated
// scans of the same checkout must serialize byte-for-byte identically, despite
// the map-based extractors whose iteration order is randomized.
func TestScanRepoDeterministic(t *testing.T) {
	repoPath := getRepoPath(t)
	a, err := yaml.Marshal(mustScan(t, repoPath))
	if err != nil {
		t.Fatal(err)
	}
	b, err := yaml.Marshal(mustScan(t, repoPath))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(a, b) {
		t.Error("ScanRepo output is not deterministic across runs")
	}
}

func mustScan(t *testing.T, repoPath string) *ScanResult {
	t.Helper()
	result, err := ScanRepo(repo.RepoContrib, repoPath)
	if err != nil {
		t.Fatalf("ScanRepo() error = %v", err)
	}
	return result
}
