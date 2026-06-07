package instrumentation

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/repo"
	"gopkg.in/yaml.v3"
)

const (
	perms = 0755
)

func TestGenerate(t *testing.T) {
	t.Run("generator - writes valid YAML", func(t *testing.T) {
		groups := []Group{
			{
				ID:        "server.span.gin",
				Type:      "span",
				Name:      "gin server span",
				Stability: StabilityDevelopment,
				Brief:     "Span for gin",
				SpanKind:  SpanKindServer,
			},
		}

		registryDir := t.TempDir()
		if err := Generate(registryDir, groups); err != nil {
			t.Fatalf("Generate() error = %v", err)
		}

		data, err := os.ReadFile(filepath.Join(registryDir, "signals.yaml"))
		if err != nil {
			t.Fatalf("ReadFile() error = %v", err)
		}

		var result map[string][]Group
		if err := yaml.Unmarshal(data, &result); err != nil {
			t.Fatalf("Unmarshal() error = %v", err)
		}

		if got := len(result["groups"]); got != 1 {
			t.Fatalf("Generate() wrote %d groups, want 1", got)
		}

		if got := result["groups"][0].ID; got != "server.span.gin" {
			t.Errorf("Generated group ID = %v, want server.span.gin", got)
		}
	})

	t.Run("generator - handles empty group list", func(t *testing.T) {
		groups := []Group{}

		registryDir := t.TempDir()
		if err := Generate(registryDir, groups); err != nil {
			t.Fatalf("Generate() error = %v", err)
		}

		data, err := os.ReadFile(filepath.Join(registryDir, "signals.yaml"))
		if err != nil {
			t.Fatalf("ReadFile() error = %v", err)
		}

		var result map[string][]Group
		if err := yaml.Unmarshal(data, &result); err != nil {
			t.Fatalf("Unmarshal() error = %v", err)
		}

		if got := len(result["groups"]); got > 0 {
			t.Errorf("Generate() wrote %d groups, want 0", got)
		}
	})
}

func TestScanRepo(t *testing.T) {
	t.Run("scanner - scans valid instrumentation directory", func(t *testing.T) {
		tmpDir := t.TempDir()
		instDir := filepath.Join(tmpDir, "instrumentation")

		pkgDir := filepath.Join(instDir, "github.com/gin-gonic/gin/otelgin")
		if err := os.MkdirAll(pkgDir, perms); err != nil {
			t.Fatal(err)
		}

		goModContent := `module go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin

go 1.24.0

require (
	github.com/gin-gonic/gin v1.11.0
	go.opentelemetry.io/otel v1.38.0
)
`
		goModPath := filepath.Join(pkgDir, "go.mod")
		if err := os.WriteFile(goModPath, []byte(goModContent), 0644); err != nil {
			t.Fatal(err)
		}

		result, err := ScanRepo(repo.RepoContrib, tmpDir)
		if err != nil {
			t.Fatalf("ScanRepo() error = %v", err)
		}

		if got := len(result.Groups); got < 0 {
			t.Fatalf("ScanRepo() found %d groups", got)
		}
	})

	t.Run("scanner - handles missing instrumentation directory", func(t *testing.T) {
		tmpDir := t.TempDir()

		result, err := ScanRepo(repo.RepoContrib, tmpDir)
		if err != nil {
			t.Fatalf("ScanRepo() error = %v", err)
		}
		if got := len(result.Groups); got != 0 {
			t.Errorf("ScanRepo() found %d groups, want 0 for missing directory", got)
		}
	})
}
