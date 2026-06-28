package instrumentation

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

func writeModule(t *testing.T, modulePath string) string {
	t.Helper()
	dir := t.TempDir()

	goMod := "module " + modulePath + "\n\ngo 1.24.0\n"
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goMod), 0644); err != nil {
		t.Fatal(err)
	}

	pkgName := filepath.Base(modulePath)
	doc := "// Package " + pkgName + " is a test fixture.\npackage " + pkgName + "\n"
	if err := os.WriteFile(filepath.Join(dir, "doc.go"), []byte(doc), 0644); err != nil {
		t.Fatal(err)
	}
	return filepath.Join(dir, "go.mod")
}

func TestAnalyzeLibrary(t *testing.T) {
	t.Run("derives metadata for a contrib module with no telemetry", func(t *testing.T) {
		modulePath := "go.opentelemetry.io/contrib/instrumentation/example.com/widget/otelwidget"
		goModPath := writeModule(t, modulePath)

		lib, err := analyzeLibrary(goModPath)
		if err != nil {
			t.Fatalf("analyzeLibrary() error = %v", err)
		}
		if lib == nil {
			t.Fatal("analyzeLibrary() returned nil library for a contrib module")
		}

		if lib.Name != "instrumentation-example.com-widget-otelwidget" {
			t.Errorf("Name = %q, want instrumentation-example.com-widget-otelwidget", lib.Name)
		}
		if lib.DisplayName != "otelwidget" {
			t.Errorf("DisplayName = %q, want otelwidget", lib.DisplayName)
		}
		if lib.Module.Path != modulePath {
			t.Errorf("Module.Path = %q", lib.Module.Path)
		}
		if lib.InstrumentationType != metadata.InstrTypeWrapper {
			t.Errorf("InstrumentationType = %v, want wrapper", lib.InstrumentationType)
		}
		if lib.Stability != metadata.StabilityExperimental {
			t.Errorf("Stability = %v, want experimental", lib.Stability)
		}
		if len(lib.Telemetry) != 0 {
			t.Errorf("Telemetry = %d entries, want 0 for a fixture with no spans/metrics", len(lib.Telemetry))
		}
	})

	t.Run("skips modules outside the contrib tree", func(t *testing.T) {
		goModPath := writeModule(t, "example.com/not/contrib/thing")

		lib, err := analyzeLibrary(goModPath)
		if err != nil {
			t.Fatalf("analyzeLibrary() error = %v", err)
		}
		if lib != nil {
			t.Errorf("analyzeLibrary() = %+v, want nil for a non-contrib module", lib)
		}
	})
}
